#!/usr/bin/env python3
"""
Fetch all Congressional Record entries from 2020-2026 and output as YAML.

Uses the Congress.gov API (Daily Congressional Record endpoint).
Requires an API key from https://api.data.gov/signup/

Usage:
    export CONGRESS_API_KEY="your_key_here"
    python fetch_congressional_records.py [--fast] [--resume] [--congress 118]

Options:
    --fast      Skip fetching article-level details (faster but less data)
    --resume    Resume from checkpoint file if it exists
    --congress  Only fetch specific congress (116, 117, 118, or 119)
    --sample N  Only fetch N issues (for testing)
"""

import os
import sys
import time
import json
import yaml
import argparse
import requests
import re
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from pathlib import Path

# Configuration
API_KEY = os.environ.get("CONGRESS_API_KEY", "DEMO_KEY")
BASE_URL = "https://api.congress.gov/v3"
RATE_LIMIT_DELAY = 0.75  # seconds between requests (stay under 5000/hour)
OUTPUT_FILE = "congressional_records_2020_2026.yaml"
CHECKPOINT_FILE = "records_checkpoint.json"

# Congresses covering 2020-2026
ALL_CONGRESSES = [116, 117, 118, 119]
START_DATE = date(2020, 1, 1)
END_DATE = date(2026, 12, 31)

# Will be set by argparse
CONGRESSES = ALL_CONGRESSES
FAST_MODE = False
SAMPLE_SIZE = None

# Article type classification patterns
PROCEDURAL_PATTERNS = [
    r"^prayer",
    r"^pledge of allegiance",
    r"^the journal",
    r"^adjournment",
    r"^recess",
    r"^quorum call",
    r"^message from",
    r"^executive message",
    r"^communication from",
    r"^enrolled bill",
    r"^executive and other communications",
    r"^reports of committees",
    r"^additional sponsors",
    r"^additional cosponsors",
    r"^submission of concurrent",
    r"^amendments submitted",
    r"^text of amendments",
    r"^authority for committees",
    r"^measures referred",
    r"^measures placed",
    r"^measures read",
    r"^executive calendar",
    r"^morning business",
    r"^order of business",
    r"^program$",
]

LEGISLATION_PATTERNS = [
    r"^providing for consideration",
    r"^consideration of",
    r"^amendment",
    r"^motion to",
    r"^cloture",
    r"^passage of",
    r"^h\.r\.",
    r"^h\. r\.",
    r"^s\.",
    r"^h\.res\.",
    r"^s\.res\.",
    r"^h\.con\.res\.",
    r"^s\.con\.res\.",
    r"^h\.j\.res\.",
    r"^s\.j\.res\.",
    r"continuing appropriations",
    r"appropriations act",
    r"authorization act",
]

TRIBUTE_PATTERNS = [
    r"^recognizing",
    r"^honoring",
    r"^commemorating",
    r"^celebrating",
    r"^congratulating",
    r"^remembering",
    r"^tribute",
    r"^in memory",
    r"^memorial",
]

SPEECH_PATTERNS = [
    r"one.?minute speech",
    r"special order",
    r"statement of",
    r"remarks by",
    r"address by",
]

EXTENSION_PATTERNS = [
    r"^extension of remarks",
    r"^senate affiliate",
]

DIGEST_PATTERNS = [
    r"^daily digest",
    r"^chamber action",
    r"^committee meetings",
]


@dataclass
class SourceLink:
    """A link to record content."""
    url: str
    source_type: str  # "text", "pdf", "html"
    source_name: str  # "congress.gov", "govinfo"
    description: Optional[str] = None


@dataclass
class Section:
    """A section within a Congressional Record issue."""
    name: str
    start_page: Optional[str] = None
    end_page: Optional[str] = None
    article_count: int = 0


@dataclass
class Article:
    """An article within a Congressional Record issue."""
    title: str
    section: str
    start_page: Optional[str] = None
    end_page: Optional[str] = None
    article_type: str = "other"  # procedural, legislation, speech, tribute, extension, digest, other
    sources: List[SourceLink] = field(default_factory=list)
    related_bills: List[str] = field(default_factory=list)


@dataclass
class Record:
    """A Congressional Record issue."""
    volume: int
    issue: int
    date: Optional[str]  # ISO format YYYY-MM-DD
    congress: int
    session: int
    sections: List[Section] = field(default_factory=list)
    articles: List[Article] = field(default_factory=list)
    sources: List[SourceLink] = field(default_factory=list)
    update_date: Optional[str] = None


def classify_article(title: str) -> str:
    """Classify an article based on its title."""
    title_lower = title.lower().strip()

    # Check each category
    for pattern in PROCEDURAL_PATTERNS:
        if re.search(pattern, title_lower):
            return "procedural"

    for pattern in DIGEST_PATTERNS:
        if re.search(pattern, title_lower):
            return "digest"

    for pattern in EXTENSION_PATTERNS:
        if re.search(pattern, title_lower):
            return "extension"

    for pattern in TRIBUTE_PATTERNS:
        if re.search(pattern, title_lower):
            return "tribute"

    for pattern in LEGISLATION_PATTERNS:
        if re.search(pattern, title_lower):
            return "legislation"

    for pattern in SPEECH_PATTERNS:
        if re.search(pattern, title_lower):
            return "speech"

    return "other"


def extract_bill_references(title: str) -> List[str]:
    """Extract bill references from article title."""
    bills = []

    # Patterns for bill references
    patterns = [
        r'\b(H\.?\s?R\.?\s*\d+)',
        r'\b(S\.?\s*\d+)',
        r'\b(H\.?\s?RES\.?\s*\d+)',
        r'\b(S\.?\s?RES\.?\s*\d+)',
        r'\b(H\.?\s?CON\.?\s?RES\.?\s*\d+)',
        r'\b(S\.?\s?CON\.?\s?RES\.?\s*\d+)',
        r'\b(H\.?\s?J\.?\s?RES\.?\s*\d+)',
        r'\b(S\.?\s?J\.?\s?RES\.?\s*\d+)',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, title, re.IGNORECASE)
        for match in matches:
            # Normalize format
            normalized = re.sub(r'\s+', '', match.upper())
            normalized = normalized.replace('.', '')
            if normalized not in bills:
                bills.append(normalized)

    return bills


def fetch_with_retry(url: str, params: Dict, max_retries: int = 3) -> Optional[Dict]:
    """Fetch URL with retry logic and rate limiting."""
    params["api_key"] = API_KEY
    params["format"] = "json"

    for attempt in range(max_retries):
        try:
            time.sleep(RATE_LIMIT_DELAY)
            response = requests.get(url, params=params, timeout=30)

            if response.status_code == 429:
                # Rate limited - wait and retry
                wait_time = 60 * (attempt + 1)
                print(f"  Rate limited, waiting {wait_time}s...")
                time.sleep(wait_time)
                continue

            if response.status_code == 404:
                return None

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"  Request error (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(5 * (attempt + 1))

    return None


def fetch_all_paginated(base_url: str, params: Dict, item_key: str) -> List[Dict]:
    """Fetch all pages of a paginated API response."""
    all_items = []
    offset = 0
    limit = 250  # Max allowed

    while True:
        params["offset"] = offset
        params["limit"] = limit

        data = fetch_with_retry(base_url, params.copy())
        if not data:
            break

        items = data.get(item_key, [])
        if not items:
            break

        all_items.extend(items)

        # Check if there are more pages
        pagination = data.get("pagination", {})
        total = pagination.get("count", 0)

        print(f"    Fetched {len(all_items)}/{total} items...")

        if len(all_items) >= total:
            break

        offset += limit

    return all_items


def fetch_issue_details(volume: int, issue: int) -> Optional[Dict]:
    """Fetch detailed information about a specific issue."""
    url = f"{BASE_URL}/daily-congressional-record/{volume}/{issue}"
    return fetch_with_retry(url, {})


def fetch_issue_articles(volume: int, issue: int) -> List[Dict]:
    """Fetch all articles for a specific issue."""
    url = f"{BASE_URL}/daily-congressional-record/{volume}/{issue}/articles"
    data = fetch_with_retry(url, {})
    if not data:
        return []
    return data.get("articles", [])


def parse_issue_to_record(issue_data: Dict, details: Optional[Dict] = None, articles_data: Optional[List] = None) -> Record:
    """Convert API issue data to our Record dataclass."""

    # Parse date
    date_str = issue_data.get("issueDate", "")
    record_date = None
    if date_str:
        try:
            # API returns YYYY-MM-DD format
            record_date = date_str[:10]
        except (ValueError, TypeError):
            record_date = None

    # Get volume and issue numbers
    volume = int(issue_data.get("volumeNumber", 0))
    issue_num = int(issue_data.get("issueNumber", 0))
    congress = int(issue_data.get("congress", 0))
    session = int(issue_data.get("sessionNumber", 1))

    # Parse sections from details
    sections = []
    sources = []

    if details:
        issue_detail = details.get("issue", {})

        # Get sections
        for sect in issue_detail.get("sections", []):
            sections.append(Section(
                name=sect.get("name", "Unknown"),
                start_page=sect.get("startPage"),
                end_page=sect.get("endPage"),
                article_count=0  # Will be updated from articles
            ))

        # Get entire issue sources
        entire_issue = issue_detail.get("entireIssue", {})
        if entire_issue:
            for fmt in entire_issue.get("formats", []):
                sources.append(SourceLink(
                    url=fmt.get("url", ""),
                    source_type=fmt.get("type", "").lower(),
                    source_name="congress.gov",
                    description="Full issue"
                ))

    # Add Congress.gov link
    sources.append(SourceLink(
        url=f"https://www.congress.gov/congressional-record/volume-{volume}/issue-{issue_num}",
        source_type="html",
        source_name="congress.gov",
        description="Issue page"
    ))

    # Parse articles
    articles = []
    section_counts = {}

    if articles_data:
        for section_group in articles_data:
            section_name = section_group.get("section", "Unknown")
            section_articles = section_group.get("sectionArticles", [])

            section_counts[section_name] = section_counts.get(section_name, 0) + len(section_articles)

            for art in section_articles:
                title = art.get("title", "Untitled")
                article_type = classify_article(title)
                related_bills = extract_bill_references(title)

                article_sources = []
                for text_item in art.get("text", []):
                    if isinstance(text_item, dict):
                        article_sources.append(SourceLink(
                            url=text_item.get("url", ""),
                            source_type=text_item.get("type", "text").lower(),
                            source_name="congress.gov",
                            description=text_item.get("type")
                        ))

                articles.append(Article(
                    title=title,
                    section=section_name,
                    start_page=art.get("startPage"),
                    end_page=art.get("endPage"),
                    article_type=article_type,
                    sources=article_sources,
                    related_bills=related_bills
                ))

    # Update section article counts
    for section in sections:
        section.article_count = section_counts.get(section.name, 0)

    return Record(
        volume=volume,
        issue=issue_num,
        date=record_date,
        congress=congress,
        session=session,
        sections=sections,
        articles=articles,
        sources=sources,
        update_date=issue_data.get("updateDate")
    )


def is_in_date_range(record: Record) -> bool:
    """Check if record falls within our target date range."""
    if not record.date:
        return True  # Include if we can't determine date

    try:
        record_date = datetime.strptime(record.date, "%Y-%m-%d").date()
        return START_DATE <= record_date <= END_DATE
    except ValueError:
        return True


def record_to_dict(record: Record) -> Dict[str, Any]:
    """Convert Record to a clean dictionary for YAML output."""
    d = {
        "volume": record.volume,
        "issue": record.issue,
        "date": record.date,
        "congress": record.congress,
        "session": record.session,
    }

    # Sections
    if record.sections:
        d["sections"] = [
            {
                "name": s.name,
                "start_page": s.start_page,
                "end_page": s.end_page,
                "article_count": s.article_count,
            }
            for s in record.sections
        ]
    else:
        d["sections"] = None

    # Sources
    if record.sources:
        d["sources"] = [
            {
                "url": s.url,
                "type": s.source_type,
                "source": s.source_name,
                **({"description": s.description} if s.description else {})
            }
            for s in record.sources if s.url
        ]
    else:
        d["sources"] = None

    # Articles (summary counts by type)
    if record.articles:
        type_counts = {}
        for art in record.articles:
            type_counts[art.article_type] = type_counts.get(art.article_type, 0) + 1

        d["article_summary"] = {
            "total": len(record.articles),
            "by_type": type_counts
        }

        # Include full articles in output
        d["articles"] = [
            {
                "title": a.title,
                "section": a.section,
                "type": a.article_type,
                "start_page": a.start_page,
                "end_page": a.end_page,
                **({"related_bills": a.related_bills} if a.related_bills else {}),
                "sources": [
                    {"url": s.url, "type": s.source_type}
                    for s in a.sources if s.url
                ] if a.sources else None
            }
            for a in record.articles
        ]
    else:
        d["article_summary"] = None
        d["articles"] = None

    return d


def save_checkpoint(records: List[Record], completed_volumes: List[int]):
    """Save progress to checkpoint file."""
    checkpoint = {
        "records": [record_to_dict(r) for r in records],
        "completed_volumes": completed_volumes,
        "timestamp": datetime.now().isoformat()
    }
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f)
    print(f"  Checkpoint saved: {len(records)} records")


def save_yaml_output(records: List[Record], output_file: str, is_complete: bool = False):
    """Write current records to YAML file (live updates)."""
    # Sort by date (most recent first)
    sorted_records = sorted(
        records,
        key=lambda r: r.date or "0000-00-00",
        reverse=True
    )

    # Calculate totals
    total_articles = sum(len(r.articles) for r in sorted_records)

    # Article type breakdown
    type_totals = {}
    for r in sorted_records:
        for art in r.articles:
            type_totals[art.article_type] = type_totals.get(art.article_type, 0) + 1

    output_data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "date_range": {
                "start": START_DATE.isoformat(),
                "end": END_DATE.isoformat()
            },
            "congresses": list(CONGRESSES),
            "total_records": len(sorted_records),
            "total_articles": total_articles,
            "article_types": type_totals,
            "mode": "fast" if FAST_MODE else "full",
            "status": "complete" if is_complete else "in_progress",
            "source": "Congress.gov API (api.congress.gov)"
        },
        "records": [record_to_dict(r) for r in sorted_records]
    }

    with open(output_file, "w", encoding="utf-8") as f:
        yaml.dump(
            output_data,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=120
        )
    print(f"  YAML updated: {output_file} ({len(records)} records, {total_articles} articles)")


def load_checkpoint() -> tuple[List[Dict], List[int]]:
    """Load progress from checkpoint file."""
    if not Path(CHECKPOINT_FILE).exists():
        return [], []

    with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
        checkpoint = json.load(f)

    return checkpoint.get("records", []), checkpoint.get("completed_volumes", [])


def dict_to_record(d: Dict) -> Record:
    """Convert a dictionary back to a Record object."""
    sections = []
    for s in (d.get("sections") or []):
        sections.append(Section(
            name=s.get("name", ""),
            start_page=s.get("start_page"),
            end_page=s.get("end_page"),
            article_count=s.get("article_count", 0)
        ))

    sources = []
    for s in (d.get("sources") or []):
        sources.append(SourceLink(
            url=s.get("url", ""),
            source_type=s.get("type", ""),
            source_name=s.get("source", ""),
            description=s.get("description")
        ))

    articles = []
    for a in (d.get("articles") or []):
        article_sources = []
        for s in (a.get("sources") or []):
            article_sources.append(SourceLink(
                url=s.get("url", ""),
                source_type=s.get("type", ""),
                source_name="congress.gov",
                description=None
            ))

        articles.append(Article(
            title=a.get("title", ""),
            section=a.get("section", ""),
            start_page=a.get("start_page"),
            end_page=a.get("end_page"),
            article_type=a.get("type", "other"),
            sources=article_sources,
            related_bills=a.get("related_bills", [])
        ))

    return Record(
        volume=d.get("volume", 0),
        issue=d.get("issue", 0),
        date=d.get("date"),
        congress=d.get("congress", 0),
        session=d.get("session", 1),
        sections=sections,
        articles=articles,
        sources=sources
    )


def fetch_records_for_congress(congress: int, all_records: List[Record], output_file: str) -> List[Record]:
    """Fetch all records for a specific congress."""
    records = []

    print(f"  Fetching Congressional Record issues for {congress}th Congress...")

    # Fetch all issues for this congress
    url = f"{BASE_URL}/daily-congressional-record"
    params = {"congress": congress}
    issues = fetch_all_paginated(url, params, "dailyCongressionalRecord")

    if SAMPLE_SIZE and len(issues) > SAMPLE_SIZE:
        issues = issues[:SAMPLE_SIZE]

    print(f"    Found {len(issues)} issues" + (", fetching details..." if not FAST_MODE else ""))

    for i, issue in enumerate(issues):
        volume = int(issue.get("volumeNumber", 0))
        issue_num = int(issue.get("issueNumber", 0))

        details = None
        articles_data = None

        if not FAST_MODE:
            # Get detailed info for richer data
            details = fetch_issue_details(volume, issue_num)
            articles_data = fetch_issue_articles(volume, issue_num)

        record = parse_issue_to_record(issue, details, articles_data)

        # Filter by date range
        if is_in_date_range(record):
            records.append(record)
            all_records.append(record)

        # Save every 25 records
        if (i + 1) % 25 == 0:
            print(f"    Processed {i + 1}/{len(issues)} issues... (saved {len(all_records)} total)")
            save_yaml_output(all_records, output_file, is_complete=False)

    return records


def main():
    global CONGRESSES, FAST_MODE, SAMPLE_SIZE

    parser = argparse.ArgumentParser(description="Fetch Congressional Records from 2020-2026")
    parser.add_argument("--fast", action="store_true", help="Skip fetching article details (faster)")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--congress", type=int, choices=[116, 117, 118, 119], help="Only fetch specific congress")
    parser.add_argument("--sample", type=int, help="Only fetch N issues (testing)")
    parser.add_argument("--output", type=str, default=OUTPUT_FILE, help="Output file path")
    args = parser.parse_args()

    FAST_MODE = args.fast
    SAMPLE_SIZE = args.sample
    output_file = args.output

    if args.congress:
        CONGRESSES = [args.congress]
    else:
        CONGRESSES = ALL_CONGRESSES

    print("=" * 60)
    print("Congressional Record Fetcher (2020-2026)")
    print("=" * 60)
    print(f"Mode: {'FAST (no articles)' if FAST_MODE else 'FULL (with articles)'}")
    print(f"Congresses: {CONGRESSES}")
    if SAMPLE_SIZE:
        print(f"Sample size: {SAMPLE_SIZE} issues")

    if API_KEY == "DEMO_KEY":
        print("\nWARNING: Using DEMO_KEY - rate limits are very restrictive (40/hour).")
        print("Get a free API key at: https://api.data.gov/signup/")
        print("Then set: export CONGRESS_API_KEY='your_key'\n")

    all_records: List[Record] = []
    completed_congresses = []

    if args.resume:
        print("Checking for checkpoint...")
        saved_records, completed_congresses = load_checkpoint()
        if saved_records:
            print(f"  Loaded {len(saved_records)} records from checkpoint")
            all_records = [dict_to_record(r) for r in saved_records]

    for congress in CONGRESSES:
        if congress in completed_congresses:
            print(f"Skipping {congress}th Congress (already completed)")
            continue

        print(f"\n{'=' * 40}")
        print(f"Fetching {congress}th Congress...")
        print(f"{'=' * 40}")

        records = fetch_records_for_congress(congress, all_records, output_file)
        completed_congresses.append(congress)

        # Save checkpoint and YAML after each congress
        save_checkpoint(all_records, completed_congresses)
        save_yaml_output(all_records, output_file, is_complete=False)
        print(f"  Completed {congress}th Congress: {len(records)} records. Total: {len(all_records)}")

    print(f"\n{'=' * 60}")
    print(f"Total records collected: {len(all_records)}")
    print(f"Total articles: {sum(len(r.articles) for r in all_records)}")
    print(f"Writing final output to {output_file}...")

    # Final write with complete status
    save_yaml_output(all_records, output_file, is_complete=True)

    print(f"Done! Output written to {output_file}")
    print(f"\nSample entry:")
    if all_records:
        print(yaml.dump(record_to_dict(all_records[0]), default_flow_style=False))

    # Clean up checkpoint
    if Path(CHECKPOINT_FILE).exists():
        Path(CHECKPOINT_FILE).unlink()
        print("Checkpoint file removed.")


if __name__ == "__main__":
    main()
