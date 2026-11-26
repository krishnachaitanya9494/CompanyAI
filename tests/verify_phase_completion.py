"""Verification script for Boolean Customization, Target Companies, and Hiring Difficulty."""
import urllib.request
import json
import sys

def test_boolean_customization():
    print("--- 1. Testing Boolean Customization for Art Director (#42) ---", flush=True)
    payload = {
        "instruction": "Focus on advertising agencies and creative production companies. Include packaging design and multichannel campaigns. Exclude interns and freshers.",
        "platform": "naukri",
        "mode": "balanced",
        "current_query": ""
    }
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/jobs/42/boolean-queries/customize",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print("Status:", resp.status, flush=True)
            print("Response Keys:", list(data.keys()), flush=True)
            print("Customized Query:", data.get("customized_query") or data.get("naukri", {}).get("query"), flush=True)
            print("Explanation:", data.get("explanation") or data.get("customization_explanation"), flush=True)
            print("Naukri Query:", data.get("naukri", {}).get("query"), flush=True)
            query_str = data.get("customized_query") or data.get("naukri", {}).get("query")
            assert resp.status == 200
            assert query_str
            print(">>> Boolean Customization PASS!", flush=True)
    except Exception as e:
        print("Boolean Customization FAILED:", e, flush=True)
        sys.exit(1)

def test_target_companies():
    print("\n--- 2. Testing Target Companies for Art Director (#42) and Item Setup (#41) ---")
    for jid, role in [(42, "Art Director"), (41, "Item Setup")]:
        url = f"http://127.0.0.1:8000/api/jobs/{jid}/target-companies"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"Job #{jid} ({role}) Status: {resp.status}")
            print(f"Ecosystem: {data.get('ecosystem_label')} | Strategy: {data.get('strategy')}")
            companies = data.get("companies", [])
            print(f"Total Companies: {len(companies)}")
            for c in companies[:3]:
                why = c.get('why_recommended') or c.get('rationale') or c.get('description') or ''
                print(f"  - {c.get('name')} | Category: {c.get('category')} | Tier: {c.get('tier_type')}")
                print(f"    Why: {why[:80]}...")
            assert len(companies) > 0
            assert resp.status == 200
    print(">>> Target Companies PASS!")

def test_hiring_difficulty():
    print("\n--- 3. Testing Hiring Difficulty HTTP Endpoint for Art Director (#42) and Item Setup (#41) ---")
    for jid, role in [(42, "Art Director"), (41, "Item Setup")]:
        url = f"http://127.0.0.1:8000/api/intelligence/hiring-difficulty/jobs/{jid}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"Job #{jid} ({role}) Status: {resp.status}")
            ai = data.get("ai_interpretation", {})
            print(f"  Difficulty Tier: {ai.get('tier')} (Score: {ai.get('score')})")
            print(f"  Bottleneck: {ai.get('primary_bottleneck')}")
            print(f"  Bottleneck Evidence: {ai.get('bottleneck_evidence')}")
            print(f"  External Market Notice: {ai.get('external_market_notice')}")
            print(f"  Executive Summary: {ai.get('executive_summary')[:120]}...")
            assert resp.status == 200
            assert ai.get("executive_summary")
            assert ai.get("primary_bottleneck")
    print(">>> Hiring Difficulty PASS!")

if __name__ == "__main__":
    test_boolean_customization()
    test_target_companies()
    test_hiring_difficulty()
    print("\nALL 3 MODULES VERIFIED SUCCESSFULLY VIA LIVE HTTP APIS!")
