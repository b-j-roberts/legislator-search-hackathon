#!/usr/bin/env python3
"""
Search Internet Archive TV News Archive for legislator appearances.

The TV News Archive contains closed captions from major networks:
- CNN, MSNBC, Fox News, Fox Business
- C-SPAN, C-SPAN2, C-SPAN3
- ABC, CBS, NBC, PBS
- BBC, Al Jazeera, and more

TV News Archive Search: https://archive.org/details/tv
"""

import json
import time
import re
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus, urlencode

# TV News Archive search endpoint (different from general archive search)
TV_SEARCH_URL = "https://archive.org/details/tv"

# Rate limiting
REQUESTS_PER_MINUTE = 30
REQUEST_DELAY = 60 / REQUESTS_PER_MINUTE


def search_tv_archive(
    query: str,
    start_year: int = 2020,
    end_year: int = 2026,
    rows: int = 100,
    page: int = 0,
) -> dict:
    """
    Search the Internet Archive TV News Archive.

    Args:
        query: Search term (e.g., legislator name)
        start_year: Start year for search
        end_year: End year for search
        rows: Number of results per page
        page: Page number (0-indexed for this API)

    Returns:
        Dict with 'total', 'items', and 'query_info'
    """
    # Build the URL manually since TV archive uses special param format
    # Format: /details/tv?q="query"&and[]=year:"2024"&and[]=year:"2023"...&output=json

    base_url = f'{TV_SEARCH_URL}?q="{quote_plus(query)}"'

    # Add year filters - TV archive uses &and[]=year:"YYYY" format
    if start_year and end_year:
        for year in range(start_year, end_year + 1):
            base_url += f'&and[]=year:"{year}"'

    # Add pagination and output format
    url = f"{base_url}&rows={rows}&page={page}&output=json"

    response = requests.get(url, timeout=60)
    response.raise_for_status()

    # The TV archive returns an array directly, not wrapped in "response"
    data = response.json()

    items = []

    # Handle both array format and potential wrapped format
    if isinstance(data, list):
        docs = data
        total = len(data)  # Approximate - API doesn't return total count easily
    else:
        docs = data.get("docs", data.get("response", {}).get("docs", []))
        total = data.get("numFound", data.get("response", {}).get("numFound", len(docs)))

    for doc in docs:
        # Parse the identifier to extract network and show info
        identifier = doc.get("identifier", "")
        parts = identifier.split("_")

        # Typical format: NETWORK_YYYYMMDD_HHMMSS_Show_Name
        network = parts[0] if parts else "Unknown"

        # Extract date from identifier if not provided
        date_str = doc.get("date", "")
        if not date_str and len(parts) > 1:
            # Try to parse YYYYMMDD from identifier
            date_match = re.search(r"(\d{8})", identifier)
            if date_match:
                d = date_match.group(1)
                date_str = f"{d[:4]}-{d[4:6]}-{d[6:8]}"

        # Get transcript snippet if available
        snippet = doc.get("snip", "")
        # Clean HTML tags from snippet
        if snippet:
            snippet = re.sub(r"<[^>]+>", "", snippet)

        items.append({
            "identifier": identifier,
            "title": doc.get("title", ""),
            "date": date_str,
            "snippet": snippet,
            "network": network,
            "collection": doc.get("collection", ""),
            "start_time": doc.get("start", ""),
            "end_time": doc.get("end", ""),
            "video_url": doc.get("video", ""),
            "thumbnail": doc.get("thumb", ""),
            "archive_url": f"https://archive.org/details/{identifier}",
            "embed_url": f"https://archive.org/embed/{identifier}",
        })

    return {
        "total": total if total > len(items) else len(items) * (page + 2),  # Estimate if not provided
        "items": items,
        "query_info": {
            "query": query,
            "start_year": start_year,
            "end_year": end_year,
            "page": page,
            "rows": rows,
        }
    }


def search_legislator(
    name: str,
    bioguide_id: str,
    start_date: str = "2020-01-01",
    end_date: str = "2026-12-31",
    max_results: int = 500,
) -> dict:
    """
    Search for all TV appearances of a legislator.

    Args:
        name: Full name of the legislator
        bioguide_id: Unique identifier for the legislator
        start_date: Start date for search (YYYY-MM-DD)
        end_date: End date for search (YYYY-MM-DD)
        max_results: Maximum total results to fetch

    Returns:
        Dict with legislator info and all appearances
    """
    # Convert dates to years for TV archive API
    start_year = int(start_date.split("-")[0])
    end_year = int(end_date.split("-")[0])

    all_items = []
    page = 0  # TV archive uses 0-indexed pages
    rows_per_page = 100
    total = 0

    print(f"Searching Internet Archive for: {name}")

    while len(all_items) < max_results:
        try:
            result = search_tv_archive(
                query=name,
                start_year=start_year,
                end_year=end_year,
                rows=rows_per_page,
                page=page,
            )

            total = result["total"]
            items = result["items"]

            if not items:
                break

            all_items.extend(items)
            print(f"  Page {page + 1}: fetched {len(items)} items (total so far: {len(all_items)})")

            # If we got fewer items than requested, we've likely hit the end
            if len(items) < rows_per_page:
                break

            if len(all_items) >= max_results:
                break

            page += 1
            time.sleep(REQUEST_DELAY)

        except Exception as e:
            print(f"  Error on page {page}: {e}")
            break

    # Deduplicate by identifier
    seen = set()
    unique_items = []
    for item in all_items:
        if item["identifier"] not in seen:
            seen.add(item["identifier"])
            unique_items.append(item)

    return {
        "bioguide_id": bioguide_id,
        "name": name,
        "total_found": len(unique_items),
        "items_fetched": len(unique_items),
        "search_params": {
            "start_date": start_date,
            "end_date": end_date,
        },
        "appearances": unique_items[:max_results],
    }


def batch_search_legislators(
    legislators: list[dict],
    start_date: str = "2020-01-01",
    end_date: str = "2026-12-31",
    max_results_per_legislator: int = 200,
    output_dir: Optional[Path] = None,
) -> list[dict]:
    """
    Search for multiple legislators and save results.

    Args:
        legislators: List of legislator dicts with 'name' and 'bioguide_id'
        start_date: Start date for all searches
        end_date: End date for all searches
        max_results_per_legislator: Max results per person
        output_dir: Directory to save individual results

    Returns:
        List of all search results
    """
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for i, leg in enumerate(legislators):
        print(f"\n[{i+1}/{len(legislators)}] Processing {leg['name']}...")

        try:
            result = search_legislator(
                name=leg["name"],
                bioguide_id=leg["bioguide_id"],
                start_date=start_date,
                end_date=end_date,
                max_results=max_results_per_legislator,
            )
            results.append(result)

            if output_dir:
                output_file = output_dir / f"{leg['bioguide_id']}_ia.json"
                with open(output_file, "w") as f:
                    json.dump(result, f, indent=2)

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({
                "bioguide_id": leg["bioguide_id"],
                "name": leg["name"],
                "error": str(e),
            })

        # Rate limiting between legislators
        time.sleep(REQUEST_DELAY)

    return results


def get_clip_captions(identifier: str) -> Optional[str]:
    """
    Fetch captions/transcript for a specific TV clip.

    The captions are typically available at:
    https://archive.org/download/{identifier}/{identifier}.cc5.txt

    Returns:
        Caption text if available, None otherwise
    """
    # Try common caption file extensions
    caption_extensions = [".cc5.txt", ".cc.txt", ".srt"]

    for ext in caption_extensions:
        url = f"https://archive.org/download/{identifier}/{identifier}{ext}"
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                return response.text
        except requests.RequestException:
            continue

    return None


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Search Internet Archive TV News")
    parser.add_argument("--name", type=str, help="Legislator name to search")
    parser.add_argument("--bioguide", type=str, default="", help="Bioguide ID")
    parser.add_argument("--start-date", type=str, default="2020-01-01")
    parser.add_argument("--end-date", type=str, default="2026-12-31")
    parser.add_argument("--max-results", type=int, default=100)
    parser.add_argument("-o", "--output", type=Path, help="Output JSON file")

    args = parser.parse_args()

    if args.name:
        result = search_legislator(
            name=args.name,
            bioguide_id=args.bioguide or args.name.replace(" ", "_"),
            start_date=args.start_date,
            end_date=args.end_date,
            max_results=args.max_results,
        )

        print(f"\nFound {result['total_found']} total appearances")
        print(f"Fetched {result['items_fetched']} items")

        if args.output:
            with open(args.output, "w") as f:
                json.dump(result, f, indent=2)
            print(f"Saved to {args.output}")
        else:
            # Print first few results
            for item in result["appearances"][:5]:
                print(f"\n  - {item['date']}: {item['title']}")
                print(f"    Network: {item['network']}")
                print(f"    URL: {item['archive_url']}")
    else:
        print("Usage: python search_internet_archive.py --name 'Bernie Sanders'")
