#!/usr/bin/env python3
"""
Enrich congressional hearings YAML with additional sources.

This script takes the output from fetch_congressional_hearings.py and adds:
- GovInfo official transcript links
- C-SPAN video archive links (where available)

Usage:
    python enrich_hearings.py congressional_hearings_2020_2026.yaml
"""

import os
import sys
import time
import yaml
import requests
from datetime import datetime
from typing import Optional, Dict, List, Any
from urllib.parse import quote


GOVINFO_API_KEY = os.environ.get("GOVINFO_API_KEY", os.environ.get("CONGRESS_API_KEY", "DEMO_KEY"))
RATE_LIMIT_DELAY = 0.5


def search_govinfo_hearing(title: str, date: str, chamber: str, congress: int) -> List[Dict]:
    """Search GovInfo for matching hearing transcripts."""
    sources = []

    # Build search query
    chamber_code = "s" if chamber and chamber.lower() == "senate" else "h"
    collection = "CHRG"

    # Try to find hearing on GovInfo
    search_url = "https://api.govinfo.gov/search"
    params = {
        "api_key": GOVINFO_API_KEY,
        "query": title[:100],  # Limit query length
        "collection": collection,
        "congress": congress,
        "pageSize": 5
    }

    try:
        time.sleep(RATE_LIMIT_DELAY)
        response = requests.get(search_url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            for result in data.get("results", []):
                package_id = result.get("packageId", "")
                if package_id:
                    sources.append({
                        "url": f"https://www.govinfo.gov/app/details/{package_id}",
                        "type": "text",
                        "source": "govinfo",
                        "description": "Official GPO transcript"
                    })
                    # Also add PDF link
                    sources.append({
                        "url": f"https://www.govinfo.gov/content/pkg/{package_id}/pdf/{package_id}.pdf",
                        "type": "pdf",
                        "source": "govinfo",
                        "description": "Official GPO transcript (PDF)"
                    })
    except Exception as e:
        print(f"  GovInfo search error: {e}")

    return sources


def search_cspan_video(title: str, date: str, committee: str) -> List[Dict]:
    """Search C-SPAN for video of the hearing."""
    sources = []

    # C-SPAN doesn't have a public API, but we can construct search URLs
    if title and date:
        search_query = quote(f"{committee or ''} {title[:50]}")
        sources.append({
            "url": f"https://www.c-span.org/search/?query={search_query}",
            "type": "video",
            "source": "c-span",
            "description": "C-SPAN search (may contain video)"
        })

    return sources


def enrich_hearing(hearing: Dict) -> Dict:
    """Add additional source links to a hearing."""
    title = hearing.get("title", "")
    date = hearing.get("date", "")
    chamber = hearing.get("chamber", "")
    congress = hearing.get("congress", 0)
    committee = hearing.get("committee", "")

    existing_sources = hearing.get("sources") or []
    existing_urls = {s.get("url") for s in existing_sources}

    # Search GovInfo for transcripts
    govinfo_sources = search_govinfo_hearing(title, date, chamber, congress)
    for source in govinfo_sources:
        if source["url"] not in existing_urls:
            existing_sources.append(source)
            existing_urls.add(source["url"])

    # Add C-SPAN search link
    cspan_sources = search_cspan_video(title, date, committee)
    for source in cspan_sources:
        if source["url"] not in existing_urls:
            existing_sources.append(source)
            existing_urls.add(source["url"])

    hearing["sources"] = existing_sources if existing_sources else None
    return hearing


def main():
    if len(sys.argv) < 2:
        print("Usage: python enrich_hearings.py <input.yaml> [output.yaml]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace(".yaml", "_enriched.yaml")

    print(f"Loading {input_file}...")
    with open(input_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    hearings = data.get("hearings", [])
    print(f"Found {len(hearings)} hearings to enrich...")

    for i, hearing in enumerate(hearings):
        if i % 100 == 0:
            print(f"Processing hearing {i + 1}/{len(hearings)}...")

        data["hearings"][i] = enrich_hearing(hearing)

    # Update metadata
    data["metadata"]["enriched_at"] = datetime.now().isoformat()

    print(f"Writing enriched data to {output_file}...")
    with open(output_file, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False, width=120)

    print("Done!")


if __name__ == "__main__":
    main()
