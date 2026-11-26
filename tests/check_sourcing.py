import requests

for jid in [42, 1]:
    r = requests.get(f"http://127.0.0.1:8000/api/jobs/{jid}", timeout=10)
    if r.status_code == 200:
        j = r.json()
        print(f"Job #{jid}: {j.get('title')}")
    
    r_tc = requests.get(f"http://127.0.0.1:8000/api/jobs/{jid}/target-companies", timeout=10)
    tc = r_tc.json()
    print(f"  Target Companies ({r_tc.status_code}): {tc.get('ecosystem_name')} ({len(tc.get('companies', []))} companies)")
    print(f"  Primary Strategy: {tc.get('primary_strategy')}")
    
    r_hd = requests.get(f"http://127.0.0.1:8000/api/intelligence/hiring-difficulty/jobs/{jid}", timeout=10)
    hd = r_hd.json()
    ai = hd.get("ai_interpretation", {})
    print(f"  Hiring Difficulty ({r_hd.status_code}): Score={hd.get('difficulty_score')}, Tier={hd.get('difficulty_classification')}")
    print(f"  Primary Bottleneck: {ai.get('primary_bottleneck')}")
    print(f"  Notice: {ai.get('external_market_notice')}")
    print("-" * 50)
