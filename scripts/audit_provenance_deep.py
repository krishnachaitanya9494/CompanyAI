import sqlite3
import json

conn = sqlite3.connect('data/companyai.db')
cur = conn.cursor()

print("=== RESUME EMBEDDING AUDIT ===")
cur.execute("""
    SELECT model_name, requested_model, returned_model, preprocessing_version, 
           dimensions, created_at, COUNT(*)
    FROM resume_embedding
    GROUP BY model_name, requested_model, returned_model, preprocessing_version, dimensions, strftime('%Y-%m-%d %H', created_at)
""")
rows = cur.fetchall()
for r in rows:
    print(r)

cur.execute("""
    SELECT id, resume_id, model_name, requested_model, returned_model, preprocessing_version, 
           input_hash, dimensions, created_at, embedding_metadata
    FROM resume_embedding LIMIT 5
""")
sample_resumes = cur.fetchall()
print("\nSample Resume Embedding rows:")
for s in sample_resumes:
    print(f"ID {s[0]}, ResumeID {s[1]}, Model: {s[2]}, ReqModel: {s[3]}, RetModel: {s[4]}, PreVersion: {s[5]}, Hash: {s[6]}, Dims: {s[7]}, Created: {s[8]}")
    print(f"  Metadata: {s[9]}")

print("\n=== JOB EMBEDDING AUDIT ===")
cur.execute("""
    SELECT job_id, embedding_type, model_name, dimensions, created_at, generation_method
    FROM job_embedding ORDER BY id
""")
job_rows = cur.fetchall()
print(f"Total Job Embeddings: {len(job_rows)}")
for jr in job_rows:
    print(f"Job {jr[0]}, Type: {jr[1]}, Model: {jr[2]}, Dims: {jr[3]}, Created: {jr[4]}, GenMethod: {jr[5]}")

conn.close()
