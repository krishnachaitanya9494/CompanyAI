import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_module_for_job(job_id: int):
    print(f"\n{'='*70}\nTESTING SOURCING INTELLIGENCE FOR JOB #{job_id}\n{'='*70}")
    
    # 1. Job details
    r = requests.get(f"{BASE_URL}/api/jobs/{job_id}", timeout=15)
    assert r.status_code == 200, f"Job #{job_id} fetch failed"
    job = r.json()
    print(f"Role Title: {job.get('title')}")
    print(f"Location: {job.get('location')} | Experience: {job.get('experienceRequired')}")
    print(f"Mandatory Skills: {job.get('requiredSkills', [])[:6]}")
    
    # 2. Boolean Query Generation
    t0 = time.time()
    r_bool = requests.post(f"{BASE_URL}/api/jobs/{job_id}/boolean-queries", json={"search_mode": "balanced"}, timeout=60)
    print(f"\n[1. BOOLEAN SEARCH] Status: {r_bool.status_code} ({time.time()-t0:.1f}s)")
    assert r_bool.status_code == 200
    bq = r_bool.json()
    print(f"  Domain: {bq.get('domain')} ({bq.get('domain_label')})")
    print(f"  Naukri Query ({len(bq.get('naukri', {}).get('query', ''))} chars): {bq.get('naukri', {}).get('query')[:120]}...")
    print(f"  LinkedIn Query: {bq.get('linkedin', {}).get('query')[:120]}...")
    print(f"  Google X-Ray: {bq.get('google_xray', {}).get('query')[:120]}...")
    print(f"  Alternative Titles: {bq.get('alternative_titles')[:4]}")
    
    # 3. Target Companies Recommendation
    t0 = time.time()
    r_tc = requests.get(f"{BASE_URL}/api/jobs/{job_id}/target-companies", timeout=15)
    print(f"\n[2. TARGET COMPANIES] Status: {r_tc.status_code} ({time.time()-t0:.1f}s)")
    assert r_tc.status_code == 200
    tc = r_tc.json()
    print(f"  Ecosystem: {tc.get('ecosystem_name')}")
    print(f"  Primary Strategy: {tc.get('primary_strategy')}")
    print(f"  Strategy Rationale: {tc.get('strategy_rationale')[:100]}...")
    print(f"  Total Recommended: {tc.get('total_companies_count')} companies")
    top_3 = tc.get('companies', [])[:3]
    for c in top_3:
        print(f"    • {c['name']} ({c['category']}) - {c['tier']} | Reason: {c.get('recommendation_reason')[:70]}... [Confidence: {c.get('confidence')}]")
        
    # 4. Market Supply & Hiring Difficulty
    t0 = time.time()
    r_hd = requests.get(f"{BASE_URL}/api/intelligence/hiring-difficulty/jobs/{job_id}", timeout=60)
    print(f"\n[3. MARKET SUPPLY & DIFFICULTY] Status: {r_hd.status_code} ({time.time()-t0:.1f}s)")
    assert r_hd.status_code == 200
    hd = r_hd.json()
    supply = hd.get("candidate_supply", {})
    ai = hd.get("ai_interpretation", {})
    print(f"  Difficulty Score: {hd.get('difficulty_score')}/100 ({hd.get('difficulty_classification')})")
    print(f"  Internal Candidate Supply: {supply.get('fully_qualified_candidates')} fully qualified / {supply.get('skill_qualified_candidates')} skill-matched / {supply.get('total_database_candidates')} total profiles")
    print(f"  Primary Bottleneck: {ai.get('primary_bottleneck')} ({ai.get('bottleneck_evidence')[:60]}...)")
    print(f"  External Market Notice: {ai.get('external_market_notice')}")
    print(f"  AI Briefing Summary: {ai.get('executive_summary', '')[:140]}...")

if __name__ == "__main__":
    # Test Job 42 (Art Director) and Job 1 (Technical / EPM)
    test_module_for_job(42)
    test_module_for_job(1)
    print("\nALL SOURCING INTELLIGENCE TESTS PASSED!")
