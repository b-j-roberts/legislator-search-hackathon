#!/usr/bin/env python3
"""
Fetch all congressional hearings from 2020-2026 and output as YAML.

Uses the Congress.gov API (Committee Meeting endpoint for rich data).
Requires an API key from https://api.data.gov/signup/

Usage:
    export CONGRESS_API_KEY="your_key_here"
    python fetch_congressional_hearings.py [--fast] [--resume] [--congress 118]

Options:
    --fast      Skip fetching individual meeting details (faster but less data)
    --resume    Resume from checkpoint file if it exists
    --congress  Only fetch specific congress (116, 117, 118, or 119)
    --sample N  Only fetch N meetings per chamber (for testing)
"""

import os
import sys
import time
import json
import yaml
import argparse
import requests
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path

# Configuration
API_KEY = os.environ.get("CONGRESS_API_KEY", "DEMO_KEY")
BASE_URL = "https://api.congress.gov/v3"
RATE_LIMIT_DELAY = 0.75  # seconds between requests (stay under 5000/hour)
OUTPUT_FILE = "congressional_hearings_2020_2026.yaml"
CHECKPOINT_FILE = "hearings_checkpoint.json"

# Congresses covering 2020-2026
ALL_CONGRESSES = [116, 117, 118, 119]
START_DATE = date(2020, 1, 1)
END_DATE = date(2026, 12, 31)

# Will be set by argparse
CONGRESSES = ALL_CONGRESSES
FAST_MODE = False
SAMPLE_SIZE = None


@dataclass
class SourceLink:
    """A link to hearing content (transcript, video, audio, etc.)"""
    url: str
    source_type: str  # "text", "video", "audio", "pdf", "html"
    source_name: str  # "congress.gov", "govinfo", "c-span", etc.
    description: Optional[str] = None


@dataclass
class Person:
    """A person involved in the hearing"""
    name: str
    role: str  # "member", "witness", "chair", etc.
    title: Optional[str] = None
    organization: Optional[str] = None
    party: Optional[str] = None
    state: Optional[str] = None


@dataclass
class Hearing:
    """A congressional hearing record"""
    title: str
    date: Optional[str]  # ISO format YYYY-MM-DD
    end_date: Optional[str] = None  # For multi-day hearings
    congress: int = 0
    chamber: Optional[str] = None  # "House", "Senate", "Joint"
    hearing_type: Optional[str] = None  # "Hearing", "Markup", "Meeting"
    committee: Optional[str] = None
    subcommittee: Optional[str] = None
    status: Optional[str] = None  # "Scheduled", "Completed", "Canceled"
    location: Optional[str] = None
    sources: List[SourceLink] = field(default_factory=list)
    members: List[Person] = field(default_factory=list)
    witnesses: List[Person] = field(default_factory=list)
    related_bills: List[str] = field(default_factory=list)
    jacket_number: Optional[str] = None
    event_id: Optional[str] = None


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


def fetch_meeting_details(congress: int, chamber: str, event_id: str) -> Optional[Dict]:
    """Fetch detailed information about a specific committee meeting."""
    url = f"{BASE_URL}/committee-meeting/{congress}/{chamber}/{event_id}"
    return fetch_with_retry(url, {})


def parse_meeting_to_hearing(meeting: Dict, details: Optional[Dict] = None) -> Hearing:
    """Convert API meeting data to our Hearing dataclass."""

    # Use details if available, otherwise use basic meeting data
    data = details.get("committeeMeeting", {}) if details else meeting

    # Parse date
    date_str = data.get("date", "")
    hearing_date = None
    if date_str:
        try:
            # API returns ISO format with time
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            hearing_date = dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            hearing_date = date_str[:10] if len(date_str) >= 10 else None

    # Parse committee info
    committees = data.get("committees", [])
    committee_name = None
    subcommittee_name = None
    if committees:
        for comm in committees:
            if "subcommittee" in comm.get("name", "").lower():
                subcommittee_name = comm.get("name")
            else:
                committee_name = comm.get("name")

    # Parse location
    location_data = data.get("location", {})
    location = None
    if isinstance(location_data, dict):
        parts = []
        if location_data.get("room"):
            parts.append(location_data["room"])
        if location_data.get("building"):
            parts.append(location_data["building"])
        if location_data.get("address"):
            parts.append(location_data["address"])
        location = ", ".join(parts) if parts else None
    elif isinstance(location_data, str):
        location = location_data

    # Parse sources/links
    sources = []

    # Video links
    for video in data.get("videos", []):
        sources.append(SourceLink(
            url=video.get("url", ""),
            source_type="video",
            source_name="congress.gov",
            description=video.get("name")
        ))

    # Meeting documents (transcripts, etc.)
    for doc in data.get("meetingDocuments", []):
        doc_type = doc.get("type", "").lower()
        source_type = "text"
        if "transcript" in doc_type:
            source_type = "text"
        elif "pdf" in doc.get("format", "").lower():
            source_type = "pdf"

        for fmt in doc.get("formats", []):
            sources.append(SourceLink(
                url=fmt.get("url", ""),
                source_type=source_type,
                source_name="congress.gov",
                description=doc.get("description") or doc.get("type")
            ))

    # Hearing transcript link
    hearing_transcript = data.get("hearingTranscript")
    if hearing_transcript:
        # Can be a dict or a list of dicts
        transcripts = hearing_transcript if isinstance(hearing_transcript, list) else [hearing_transcript]
        for transcript in transcripts:
            if isinstance(transcript, dict):
                jacket = transcript.get("jacketNumber")
                if jacket:
                    chamber_code = "s" if data.get("chamber", "").lower() == "senate" else "h"
                    sources.append(SourceLink(
                        url=f"https://www.govinfo.gov/app/details/CHRG-{data.get('congress', '')}{chamber_code}hrg{jacket}",
                        source_type="text",
                        source_name="govinfo",
                        description="Official hearing transcript"
                    ))

    # Parse witnesses
    witnesses = []
    for witness in data.get("witnesses", []):
        witnesses.append(Person(
            name=witness.get("name", "Unknown"),
            role="witness",
            title=witness.get("position"),
            organization=witness.get("organization")
        ))

    # Related bills
    related_bills = []
    for item in data.get("relatedItems", {}).get("bills", []):
        bill_num = f"{item.get('type', '')}{item.get('number', '')}"
        if bill_num:
            related_bills.append(bill_num)

    return Hearing(
        title=data.get("title", "Untitled Hearing"),
        date=hearing_date,
        congress=data.get("congress", 0),
        chamber=data.get("chamber"),
        hearing_type=data.get("type"),
        committee=committee_name,
        subcommittee=subcommittee_name,
        status=data.get("meetingStatus"),
        location=location,
        sources=sources,
        members=[],  # Would need additional API calls to get member info
        witnesses=witnesses,
        related_bills=related_bills,
        event_id=str(data.get("eventId", ""))
    )


def is_in_date_range(hearing: Hearing) -> bool:
    """Check if hearing falls within our target date range."""
    if not hearing.date:
        return True  # Include if we can't determine date

    try:
        hearing_date = datetime.strptime(hearing.date, "%Y-%m-%d").date()
        return START_DATE <= hearing_date <= END_DATE
    except ValueError:
        return True




def hearing_to_dict(hearing: Hearing) -> Dict[str, Any]:
    """Convert Hearing to a clean dictionary for YAML output."""
    d = {
        "title": hearing.title,
        "date": hearing.date,
    }

    if hearing.end_date:
        d["end_date"] = hearing.end_date

    d["congress"] = hearing.congress
    d["chamber"] = hearing.chamber

    if hearing.hearing_type:
        d["type"] = hearing.hearing_type
    if hearing.committee:
        d["committee"] = hearing.committee
    if hearing.subcommittee:
        d["subcommittee"] = hearing.subcommittee
    if hearing.status:
        d["status"] = hearing.status
    if hearing.location:
        d["location"] = hearing.location

    # Sources
    if hearing.sources:
        d["sources"] = [
            {
                "url": s.url,
                "type": s.source_type,
                "source": s.source_name,
                **({"description": s.description} if s.description else {})
            }
            for s in hearing.sources if s.url
        ]
    else:
        d["sources"] = None

    # Members
    if hearing.members:
        d["members"] = [
            {
                "name": p.name,
                "role": p.role,
                **({"title": p.title} if p.title else {}),
                **({"party": p.party} if p.party else {}),
                **({"state": p.state} if p.state else {}),
            }
            for p in hearing.members
        ]
    else:
        d["members"] = None

    # Witnesses
    if hearing.witnesses:
        d["witnesses"] = [
            {
                "name": p.name,
                **({"title": p.title} if p.title else {}),
                **({"organization": p.organization} if p.organization else {}),
            }
            for p in hearing.witnesses
        ]
    else:
        d["witnesses"] = None

    # Related bills
    if hearing.related_bills:
        d["related_bills"] = hearing.related_bills
    else:
        d["related_bills"] = None

    return d


def save_checkpoint(hearings: List[Hearing], completed_congresses: List[tuple]):
    """Save progress to checkpoint file."""
    checkpoint = {
        "hearings": [hearing_to_dict(h) for h in hearings],
        "completed": completed_congresses,
        "timestamp": datetime.now().isoformat()
    }
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f)
    print(f"  Checkpoint saved: {len(hearings)} hearings")


def save_yaml_output(hearings: List[Hearing], output_file: str, is_complete: bool = False):
    """Write current hearings to YAML file (live updates)."""
    # Sort by date (most recent first)
    sorted_hearings = sorted(
        hearings,
        key=lambda h: h.date or "0000-00-00",
        reverse=True
    )

    output_data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "date_range": {
                "start": START_DATE.isoformat(),
                "end": END_DATE.isoformat()
            },
            "congresses": list(CONGRESSES),
            "total_hearings": len(sorted_hearings),
            "mode": "fast" if FAST_MODE else "full",
            "status": "complete" if is_complete else "in_progress",
            "source": "Congress.gov API (api.congress.gov)"
        },
        "hearings": [hearing_to_dict(h) for h in sorted_hearings]
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
    print(f"  YAML updated: {output_file} ({len(hearings)} hearings)")


def load_checkpoint() -> tuple[List[Dict], List[tuple]]:
    """Load progress from checkpoint file."""
    if not Path(CHECKPOINT_FILE).exists():
        return [], []

    with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
        checkpoint = json.load(f)

    return checkpoint.get("hearings", []), checkpoint.get("completed", [])


def main():
    global CONGRESSES, FAST_MODE, SAMPLE_SIZE

    parser = argparse.ArgumentParser(description="Fetch congressional hearings from 2020-2026")
    parser.add_argument("--fast", action="store_true", help="Skip fetching details (faster)")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--congress", type=int, choices=[116, 117, 118, 119], help="Only fetch specific congress")
    parser.add_argument("--sample", type=int, help="Only fetch N meetings per chamber (testing)")
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
    print("Congressional Hearings Fetcher (2020-2026)")
    print("=" * 60)
    print(f"Mode: {'FAST (no details)' if FAST_MODE else 'FULL (with details)'}")
    print(f"Congresses: {CONGRESSES}")
    if SAMPLE_SIZE:
        print(f"Sample size: {SAMPLE_SIZE} per chamber")

    if API_KEY == "DEMO_KEY":
        print("\nWARNING: Using DEMO_KEY - rate limits are very restrictive (40/hour).")
        print("Get a free API key at: https://api.data.gov/signup/")
        print("Then set: export CONGRESS_API_KEY='your_key'\n")

    all_hearings: List[Hearing] = []
    completed = []

    if args.resume:
        print("Checking for checkpoint...")
        saved_hearings, completed = load_checkpoint()
        if saved_hearings:
            print(f"  Loaded {len(saved_hearings)} hearings from checkpoint")
            # Convert dicts back to Hearing objects (simplified - just use dicts)
            all_hearings = [dict_to_hearing(h) for h in saved_hearings]

    for congress in CONGRESSES:
        for chamber in ["house", "senate"]:
            if (congress, chamber) in [(c[0], c[1]) for c in completed]:
                print(f"Skipping {congress}th Congress {chamber.title()} (already completed)")
                continue

            print(f"\n{'=' * 40}")
            print(f"Fetching {congress}th Congress {chamber.title()}...")
            print(f"{'=' * 40}")

            hearings = fetch_hearings_for_congress_chamber(congress, chamber)
            all_hearings.extend(hearings)
            completed.append((congress, chamber))

            # Save checkpoint and YAML after each chamber
            save_checkpoint(all_hearings, completed)
            save_yaml_output(all_hearings, output_file, is_complete=False)
            print(f"  Total hearings so far: {len(all_hearings)}")

    print(f"\n{'=' * 60}")
    print(f"Total hearings collected: {len(all_hearings)}")
    print(f"Writing final output to {output_file}...")

    # Final write with complete status
    save_yaml_output(all_hearings, output_file, is_complete=True)

    print(f"Done! Output written to {output_file}")
    print(f"\nSample entry:")
    if all_hearings:
        print(yaml.dump(hearing_to_dict(all_hearings[0]), default_flow_style=False))

    # Clean up checkpoint
    if Path(CHECKPOINT_FILE).exists():
        Path(CHECKPOINT_FILE).unlink()
        print("Checkpoint file removed.")


def dict_to_hearing(d: Dict) -> Hearing:
    """Convert a dictionary back to a Hearing object."""
    sources = []
    for s in (d.get("sources") or []):
        sources.append(SourceLink(
            url=s.get("url", ""),
            source_type=s.get("type", ""),
            source_name=s.get("source", ""),
            description=s.get("description")
        ))

    members = []
    for m in (d.get("members") or []):
        members.append(Person(
            name=m.get("name", ""),
            role=m.get("role", ""),
            title=m.get("title"),
            party=m.get("party"),
            state=m.get("state")
        ))

    witnesses = []
    for w in (d.get("witnesses") or []):
        witnesses.append(Person(
            name=w.get("name", ""),
            role="witness",
            title=w.get("title"),
            organization=w.get("organization")
        ))

    return Hearing(
        title=d.get("title", ""),
        date=d.get("date"),
        end_date=d.get("end_date"),
        congress=d.get("congress", 0),
        chamber=d.get("chamber"),
        hearing_type=d.get("type"),
        committee=d.get("committee"),
        subcommittee=d.get("subcommittee"),
        status=d.get("status"),
        location=d.get("location"),
        sources=sources,
        members=members,
        witnesses=witnesses,
        related_bills=d.get("related_bills") or []
    )


def fetch_hearings_for_congress_chamber(congress: int, chamber: str) -> List[Hearing]:
    """Fetch all hearings for a specific congress and chamber."""
    hearings = []

    print(f"  Fetching {chamber.title()} committee meetings...")

    url = f"{BASE_URL}/committee-meeting/{congress}/{chamber}"
    meetings = fetch_all_paginated(url, {}, "committeeMeetings")

    if SAMPLE_SIZE and len(meetings) > SAMPLE_SIZE:
        meetings = meetings[:SAMPLE_SIZE]

    print(f"    Found {len(meetings)} meetings" + (", fetching details..." if not FAST_MODE else ""))

    for i, meeting in enumerate(meetings):
        if i % 50 == 0 and i > 0:
            print(f"    Processing meeting {i + 1}/{len(meetings)}...")

        details = None
        if not FAST_MODE:
            # Get detailed info for richer data
            event_id = meeting.get("eventId")
            if event_id:
                details = fetch_meeting_details(congress, chamber, event_id)

        hearing = parse_meeting_to_hearing(meeting, details)

        # Filter by date range
        if is_in_date_range(hearing):
            hearings.append(hearing)

    return hearings


if __name__ == "__main__":
    main()
