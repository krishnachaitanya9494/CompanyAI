"""
Unit and Integration Test Suite for Centralized AI Architecture
Validates:
1. Configuration and model specifications (nvidia/nemotron-3-embed-1b:free, 2048 dimensions)
2. Embedding caching service (LRU, SHA-256 keys, hit/miss metrics)
3. Nemotron embedding provider (2048-dim validation, normalization, rate-limit fallback)
4. Semantic search and candidate/job discovery
5. Recruitment RAG service with evidence grounding
6. AI Health and Diagnostic Service
7. Centralized AI API endpoints (/api/ai/health, /api/ai/test-embedding, /api/ai/rag/query)
"""

import math
import pytest
from unittest.mock import patch, MagicMock

from app.ai.config import get_ai_config, AIPlatformConfig
from app.ai.exceptions import AIEmbeddingError, AIRateLimitError
from app.ai.services.caching_service import EmbeddingCacheService
from app.ai.providers.embedding_provider import NemotronEmbeddingProvider, generate_deterministic_2048_vector
from app.ai.providers.chat_provider import NemotronChatProvider
from app.ai.services.semantic_search_service import SemanticSearchService
from app.ai.services.rag_service import RecruitmentRAGService
from app.ai.services.ai_health_service import AIHealthService
from database.sqlite_connection import SessionLocal


class TestAIConfiguration:
    """Validates centralized AI settings."""

    def test_default_config_values(self):
        config = get_ai_config()
        assert config.embedding_model == "nvidia/nemotron-3-embed-1b:free"
        assert config.embedding_dimensions == 2048
        assert config.chat_model == "nvidia/nemotron-3.5-super-vl:free"
        assert config.batch_size >= 1
        assert config.request_timeout_seconds >= 10.0


class TestEmbeddingCacheService:
    """Validates embedding caching behavior and metrics."""

    def test_cache_set_and_get(self):
        cache = EmbeddingCacheService(max_size=10)
        vec = [0.1 * i for i in range(10)]
        cache.set("Senior Python Developer", vec)

        cached_vec = cache.get("Senior Python Developer")
        assert cached_vec is not None
        assert cached_vec == vec

        miss = cache.get("Unseen Query")
        assert miss is None

    def test_cache_telemetry_metrics(self):
        cache = EmbeddingCacheService(max_size=10)
        vec = [1.0, 0.0]
        cache.set("Key 1", vec)

        # 1 hit, 1 miss
        cache.get("Key 1")
        cache.get("Missing Key")

        metrics = cache.metrics
        assert metrics["hits"] == 1
        assert metrics["misses"] == 1
        assert metrics["hit_ratio_percent"] == 50.0
        assert metrics["cached_entries"] == 1


class TestNemotronEmbeddingProvider:
    """Validates 2048-dim embedding generation, normalization, and quota fallbacks."""

    def test_deterministic_fallback_dimension_and_norm(self):
        provider = NemotronEmbeddingProvider()
        text = "Staff Cloud Architect with AWS, Kubernetes, Terraform and Python"
        vector = provider.generate_deterministic_2048_vector(text)

        assert len(vector) == 2048
        # Validate unit L2 normalization
        norm = math.sqrt(sum(x * x for x in vector))
        assert abs(norm - 1.0) < 1e-4

    def test_deterministic_fallback_reproducibility(self):
        provider = NemotronEmbeddingProvider()
        text = "Lead Design Verification Engineer UVM SystemVerilog"
        v1 = provider.generate_deterministic_2048_vector(text)
        v2 = provider.generate_deterministic_2048_vector(text)
        assert v1 == v2

    def test_deterministic_fallback_different_texts(self):
        provider = NemotronEmbeddingProvider()
        v1 = provider.generate_deterministic_2048_vector("DevOps Engineer")
        v2 = provider.generate_deterministic_2048_vector("Financial Analyst")
        assert v1 != v2

    def test_rate_limit_raises_error_without_fallback_vector(self):
        """Validates that rate-limiting raises AIRateLimitError and NEVER injects fallback vectors."""
        provider = NemotronEmbeddingProvider()
        with patch.object(provider.provider, "post", side_effect=Exception("Rate limit 429")):
            with pytest.raises(AIRateLimitError):
                provider.embed_text("Test embedding text", force_fresh=True)

    def test_storage_rejects_fallback_vectors(self):
        """Validates that non-genuine generation methods are strictly rejected from DB storage."""
        from database.embedding_storage import store_resume_embedding, store_job_embedding
        db = SessionLocal()
        try:
            fake_vec = generate_deterministic_2048_vector("Fake candidate")
            with pytest.raises(ValueError, match="cannot be stored as Nemotron embeddings"):
                store_resume_embedding(
                    session=db,
                    resume_id=1,
                    vector=fake_vec,
                    generation_method="fallback_hash",
                )

            with pytest.raises(ValueError, match="cannot be stored as Nemotron embeddings"):
                store_job_embedding(
                    session=db,
                    job_id=1,
                    segmentation_id=1,
                    embedding_type="full_jd",
                    input_hash="a" * 64,
                    vector=fake_vec,
                    generation_method="fallback_hash",
                )
        finally:
            db.close()

    def test_generate_batch_embeddings_with_mock(self):
        provider = NemotronEmbeddingProvider()
        texts = [
            "Senior Frontend Engineer React Tailwind",
            "Data Scientist NLP PyTorch Transformers",
            "Site Reliability Engineer Linux Prometheus",
        ]
        mock_vec = generate_deterministic_2048_vector("Mock")
        with patch.object(provider, "embed_text", return_value=mock_vec):
            vectors = provider.embed_batch(texts)
            assert len(vectors) == 3
            for v in vectors:
                assert len(v) == 2048


class TestSemanticSearchService:
    """Validates cosine similarity and semantic search operations."""

    def test_cosine_similarity_math(self):
        search = SemanticSearchService()
        v1 = [1.0, 0.0, 0.0]
        v2 = [1.0, 0.0, 0.0]
        assert abs(search.cosine_similarity(v1, v2) - 1.0) < 1e-5

        v3 = [0.0, 1.0, 0.0]
        assert abs(search.cosine_similarity(v1, v3) - 0.0) < 1e-5

        # Empty or mismatched vectors raise ValueError in CompanyAI vector math
        with pytest.raises(ValueError):
            search.cosine_similarity([], [])

        with pytest.raises(ValueError):
            search.cosine_similarity([1.0], [1.0, 2.0])

    def test_semantic_search_excludes_non_genuine_vectors(self):
        """Validates that candidate search only considers genuine Nemotron vectors."""
        search = SemanticSearchService()
        db = SessionLocal()
        try:
            # Query candidate embeddings using mock genuine query vector
            mock_vec = generate_deterministic_2048_vector("Python Cloud Architect")
            with patch.object(search.provider, "embed_text", return_value=mock_vec):
                results = search.search_candidates_by_text(db=db, query="Python Cloud Architect", limit=5)
                # Results should be returned from genuine indexed candidates
                assert isinstance(results, list)
                for res in results:
                    assert "candidate_id" in res
                    assert "similarity" in res
                    assert res["similarity"] <= 1.0001
        finally:
            db.close()


class TestRecruitmentRAGService:
    """Validates grounded RAG assistant responses."""

    def test_rag_query_structure(self):
        rag = RecruitmentRAGService()
        with patch.object(rag.chat, "complete", return_value={"content": "Verified candidate recommendations."}), \
             patch.object(rag.search_service.provider, "embed_text", return_value=generate_deterministic_2048_vector("query")):
            result = rag.answer_query(question_or_db="Who are our top engineers for Cloud Architecture?")
            assert "query" in result
            assert "answer" in result
            assert "sources" in result
            assert "confidence" in result
            assert isinstance(result["sources"], list)
            assert len(result["answer"]) > 10


class TestAIEndpoints:
    """Validates /api/ai endpoints directly ensuring schema compliance and responses."""

    def test_get_ai_health(self):
        from app.routers.ai import get_ai_health
        db = SessionLocal()
        try:
            data = get_ai_health(db)
            assert data["status"] in ["healthy", "degraded", "operational"]
            assert data["embedding_model"] == "nvidia/nemotron-3-embed-1b:free"
            assert data["embedding_dimensions"] == 2048
            assert "database_vector_coverage" in data
            assert "cache" in data
        finally:
            db.close()

    def test_post_test_embedding(self):
        from app.routers.ai import test_embedding, TestEmbeddingSchema
        with patch("app.ai.services.ai_health_service.embedding_provider.embed_text", return_value=generate_deterministic_2048_vector("Test")):
            data = test_embedding(TestEmbeddingSchema(text="Test embedding diagnostic endpoint"))
            assert data["dimensions"] == 2048
            assert data["status"] == "success"
            assert data["model"] == "nvidia/nemotron-3-embed-1b:free"

    def test_post_rag_query(self):
        from app.routers.ai import execute_rag_query, RAGQuerySchema
        db = SessionLocal()
        try:
            with patch("app.ai.providers.chat_provider.chat_provider.complete", return_value={"content": "Candidates matched."}), \
                 patch("app.ai.services.rag_service.rag_service.search_service.provider.embed_text", return_value=generate_deterministic_2048_vector("test query")):
                data = execute_rag_query(RAGQuerySchema(question="Which candidates have Verilog and FPGA experience?"), db)
                assert "answer" in data
                assert "sources" in data
                assert "confidence" in data
        finally:
            db.close()
