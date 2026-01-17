#!/usr/bin/env python3
"""
Congressional Vote Fetcher
Fetches vote data from Congress.gov API (House) and Senate.gov XML (Senate)
and compiles it into a YAML file.
"""

import os
import sys
import time
import json
import yaml
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict, field
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Congress.gov API base URL
API_BASE = "https://api.congress.gov/v3"

# Thread-safe print lock
print_lock = threading.Lock()

def safe_print(msg):
    with print_lock:
        print(msg, file=sys.stderr, flush=True)

@dataclass
class VoteOutcome:
    """Voting outcome breakdown"""
    result: str
    yea_total: int = 0
    nay_total: int = 0
    present: int = 0
    not_voting: int = 0
    democrat_yea: int = 0
    democrat_nay: int = 0
    republican_yea: int = 0
    republican_nay: int = 0
    independent_yea: int = 0
    independent_nay: int = 0

@dataclass
class CongressionalVote:
    """A single congressional vote record"""
    vote_id: str
    title: str
    chamber: str
    congress: int
    session: int
    roll_call_number: int
    date: str
    question: str
    vote_type: str
    result: str
    sources: List[Dict[str, str]]
    key_members: List[str]
    outcome: Dict[str, Any]
    party_flippers: List[Dict[str, str]]
    bill_number: Optional[str] = None
    bill_title: Optional[str] = None


class CongressAPIClient:
    """Client for Congress.gov API (House votes)"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.request_delay = 0.1  # Reduced delay

    def _request(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """Make request to the API"""
        url = f"{API_BASE}{endpoint}"
        if params is None:
            params = {}
        params["api_key"] = self.api_key
        params["format"] = "json"

        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            time.sleep(self.request_delay)
            return response.json()
        except requests.exceptions.RequestException as e:
            return {}

    def get_house_votes_list(self, congress: int = None, offset: int = 0, limit: int = 250) -> Dict:
        """Get list of House votes"""
        endpoint = "/house-vote"
        params = {"offset": offset, "limit": limit}
        if congress:
            endpoint = f"/house-vote/{congress}"
        return self._request(endpoint, params)

    def get_house_vote_detail(self, congress: int, session: int, roll_number: int) -> Dict:
        """Get detailed House vote info"""
        endpoint = f"/house-vote/{congress}/{session}/{roll_number}"
        return self._request(endpoint)

    def get_house_vote_members(self, congress: int, session: int, roll_number: int) -> Dict:
        """Get member votes for a House roll call"""
        endpoint = f"/house-vote/{congress}/{session}/{roll_number}/members"
        return self._request(endpoint)


class SenateVoteFetcher:
    """Fetches Senate votes from Senate.gov XML"""

    def __init__(self):
        self.session = requests.Session()
        # Add browser-like headers to avoid WAF blocking
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/xml,text/xml,*/*;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        })
        self.base_url = "https://www.senate.gov/legislative/LIS/roll_call_votes"

    def get_vote_xml(self, congress: int, session: int, vote_number: int) -> Optional[ET.Element]:
        """Fetch a specific Senate vote XML"""
        url = f"{self.base_url}/vote{congress}{session}/vote_{congress}_{session}_{vote_number:05d}.xml"

        try:
            response = self.session.get(url, timeout=30)
            time.sleep(0.1)  # Small delay to avoid rate limiting
            if response.status_code == 404:
                return None
            if response.status_code == 403:
                # WAF blocking - wait and retry once
                time.sleep(1)
                response = self.session.get(url, timeout=30)
                if response.status_code != 200:
                    return None
            response.raise_for_status()
            return ET.fromstring(response.content)
        except Exception:
            return None

    def parse_vote(self, xml_root: ET.Element) -> Dict:
        """Parse Senate vote XML into structured data"""
        def get_text(elem, path, default=""):
            el = elem.find(path)
            return el.text if el is not None and el.text else default

        vote_data = {
            "congress": int(get_text(xml_root, "congress", "0")),
            "session": int(get_text(xml_root, "session", "0")),
            "vote_number": int(get_text(xml_root, "vote_number", "0")),
            "date": get_text(xml_root, "vote_date"),
            "question": get_text(xml_root, "vote_question_text"),
            "title": get_text(xml_root, "vote_title"),
            "result": get_text(xml_root, "vote_result"),
            "result_text": get_text(xml_root, "vote_result_text"),
            "vote_type": get_text(xml_root, "question"),
        }

        doc = xml_root.find("document")
        if doc is not None:
            vote_data["bill_type"] = get_text(doc, "document_type")
            vote_data["bill_number"] = get_text(doc, "document_number")
            vote_data["bill_title"] = get_text(doc, "document_title")

        count = xml_root.find("count")
        if count is not None:
            vote_data["yeas"] = int(get_text(count, "yeas", "0"))
            vote_data["nays"] = int(get_text(count, "nays", "0"))
            vote_data["present"] = int(get_text(count, "present", "0") or "0")
            vote_data["absent"] = int(get_text(count, "absent", "0") or "0")

        members = []
        members_elem = xml_root.find("members")
        if members_elem is not None:
            for member in members_elem.findall("member"):
                members.append({
                    "name": get_text(member, "member_full"),
                    "first_name": get_text(member, "first_name"),
                    "last_name": get_text(member, "last_name"),
                    "party": get_text(member, "party"),
                    "state": get_text(member, "state"),
                    "vote": get_text(member, "vote_cast"),
                })
        vote_data["members"] = members

        return vote_data


def analyze_party_votes(members: List[Dict]) -> Dict:
    """Analyze party voting breakdown"""
    party_totals = {
        "D": {"yea": 0, "nay": 0, "present": 0, "not_voting": 0},
        "R": {"yea": 0, "nay": 0, "present": 0, "not_voting": 0},
        "I": {"yea": 0, "nay": 0, "present": 0, "not_voting": 0},
    }

    for member in members:
        party = member.get("party", "")
        vote = member.get("vote", "").lower()

        if party not in party_totals:
            party = "I"

        if vote in ["yea", "aye", "yes"]:
            party_totals[party]["yea"] += 1
        elif vote in ["nay", "no"]:
            party_totals[party]["nay"] += 1
        elif vote == "present":
            party_totals[party]["present"] += 1
        else:
            party_totals[party]["not_voting"] += 1

    return party_totals


def find_party_flippers(members: List[Dict]) -> List[Dict[str, str]]:
    """Find members who voted against their party's majority"""
    party_votes = {"D": {"yea": 0, "nay": 0}, "R": {"yea": 0, "nay": 0}, "I": {"yea": 0, "nay": 0}}

    for member in members:
        party = member.get("party", "I")
        vote = member.get("vote", "").lower()
        if party not in party_votes:
            party = "I"
        if vote in ["yea", "aye", "yes"]:
            party_votes[party]["yea"] += 1
        elif vote in ["nay", "no"]:
            party_votes[party]["nay"] += 1

    party_majority = {}
    for party, votes in party_votes.items():
        if votes["yea"] > votes["nay"]:
            party_majority[party] = "Yea"
        elif votes["nay"] > votes["yea"]:
            party_majority[party] = "Nay"
        else:
            party_majority[party] = "Split"

    flippers = []
    for member in members:
        party = member.get("party", "I")
        if party not in party_majority:
            party = "I"
        vote = member.get("vote", "").lower()
        name = member.get("name") or f"{member.get('first_name', '')} {member.get('last_name', '')}"

        expected = party_majority.get(party, "Split")

        if expected == "Split":
            continue

        vote_normalized = "Yea" if vote in ["yea", "aye", "yes"] else ("Nay" if vote in ["nay", "no"] else None)

        if vote_normalized and vote_normalized != expected:
            flippers.append({
                "name": name.strip(),
                "party": party,
                "vote": vote_normalized,
                "party_majority_vote": expected
            })

    return flippers


def process_house_vote(args) -> Optional[CongressionalVote]:
    """Process a single House vote (for parallel execution)"""
    client, vote_summary, congress, start_year, end_year = args

    roll_number = vote_summary.get("rollCallNumber")
    session = vote_summary.get("sessionNumber")
    start_date = vote_summary.get("startDate", "")

    if not roll_number or not session:
        return None

    vote_year = int(start_date[:4]) if start_date else 0
    if vote_year < start_year or vote_year > end_year:
        return None

    # Get vote details
    detail = client.get_house_vote_detail(congress, session, roll_number)
    vote_info = detail.get("houseRollCallVote", {})

    # Get member votes
    members_resp = client.get_house_vote_members(congress, session, roll_number)
    members_info = members_resp.get("houseRollCallVoteMemberVotes", {})
    member_results = members_info.get("results", [])

    members = []
    for m in member_results:
        members.append({
            "name": f"{m.get('firstName', '')} {m.get('lastName', '')}",
            "party": m.get("voteParty", ""),
            "state": m.get("voteState", ""),
            "vote": m.get("voteCast", "")
        })

    flippers = find_party_flippers(members)

    vote_party_total = vote_info.get("votePartyTotal", [])
    outcome = VoteOutcome(result=vote_info.get("result", "Unknown"))

    for pt in vote_party_total:
        party_type = pt.get("voteParty", "")
        if party_type == "D":
            outcome.democrat_yea = pt.get("yeaTotal", 0) or 0
            outcome.democrat_nay = pt.get("nayTotal", 0) or 0
        elif party_type == "R":
            outcome.republican_yea = pt.get("yeaTotal", 0) or 0
            outcome.republican_nay = pt.get("nayTotal", 0) or 0
        elif party_type == "I":
            outcome.independent_yea = pt.get("yeaTotal", 0) or 0
            outcome.independent_nay = pt.get("nayTotal", 0) or 0

    outcome.yea_total = outcome.democrat_yea + outcome.republican_yea + outcome.independent_yea
    outcome.nay_total = outcome.democrat_nay + outcome.republican_nay + outcome.independent_nay

    sources = [
        {"url": vote_summary.get("sourceDataURL", ""), "source_type": "xml", "label": "House Clerk XML"},
        {"url": f"https://www.congress.gov/roll-call-vote/{congress}-{session}/house/{roll_number}", "source_type": "text", "label": "Congress.gov Vote Record"},
    ]

    leg_url = vote_summary.get("legislationUrl", "")
    if leg_url:
        sources.append({"url": leg_url, "source_type": "text", "label": "Legislation Page"})

    key_members = [f"{f['name']} ({f['party']} - voted {f['vote']})" for f in flippers[:5]]

    bill_number = None
    leg_type = vote_summary.get("legislationType", "")
    leg_num = vote_summary.get("legislationNumber", "")
    if leg_type and leg_num:
        bill_number = f"{leg_type} {leg_num}"

    return CongressionalVote(
        vote_id=f"{congress}-house-{session}-{roll_number}",
        title=vote_info.get("voteQuestion", "") or vote_summary.get("result", "Unknown"),
        chamber="House",
        congress=congress,
        session=session,
        roll_call_number=roll_number,
        date=start_date[:10] if start_date else "",
        question=vote_info.get("voteQuestion", ""),
        vote_type=vote_info.get("voteType", ""),
        result=vote_info.get("result", ""),
        bill_number=bill_number,
        bill_title=None,
        sources=sources,
        key_members=key_members,
        outcome=asdict(outcome),
        party_flippers=flippers
    )


def fetch_house_votes_live(api_key: str, start_year: int, end_year: int, all_votes: List, save_callback) -> int:
    """Fetch House votes using Congress.gov API with parallel processing and live saves"""
    client = CongressAPIClient(api_key)
    total_added = 0

    year_to_congress = {
        2019: 116, 2020: 116,
        2021: 117, 2022: 117,
        2023: 118, 2024: 118,
        2025: 119, 2026: 119
    }

    congresses = set()
    for year in range(start_year, end_year + 1):
        if year in year_to_congress:
            congresses.add(year_to_congress[year])

    for congress in sorted(congresses):
        safe_print(f"\n  Fetching House votes for {congress}th Congress...")

        offset = 0
        limit = 250
        all_vote_summaries = []

        # First, collect all vote summaries
        while True:
            response = client.get_house_votes_list(congress=congress, offset=offset, limit=limit)
            votes_list = response.get("houseRollCallVotes", [])

            if not votes_list:
                break

            all_vote_summaries.extend(votes_list)
            safe_print(f"    Found {len(all_vote_summaries)} votes...")

            pagination = response.get("pagination", {})
            total = pagination.get("count", 0)
            if offset + limit >= total:
                break
            offset += limit

        if not all_vote_summaries:
            safe_print(f"    No votes found for {congress}th Congress")
            continue

        safe_print(f"    Processing {len(all_vote_summaries)} votes in parallel...")

        # Process votes in parallel
        processed = 0
        congress_added = 0
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for vote_summary in all_vote_summaries:
                args = (client, vote_summary, congress, start_year, end_year)
                futures.append(executor.submit(process_house_vote, args))

            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        all_votes.append(result)
                        congress_added += 1
                        total_added += 1
                    processed += 1
                    if processed % 50 == 0:
                        safe_print(f"    Processed {processed}/{len(all_vote_summaries)} votes... (saved {len(all_votes)} total)")
                        save_callback()
                except Exception:
                    processed += 1

        save_callback()
        safe_print(f"    Total House votes for {congress}th Congress: {congress_added}")

    return total_added


def fetch_senate_votes_live(start_year: int, end_year: int, all_votes: List, save_callback) -> int:
    """Fetch Senate votes from Senate.gov XML with parallel processing and live saves"""
    fetcher = SenateVoteFetcher()
    total_added = 0

    year_to_congress_session = {
        2019: (116, 1), 2020: (116, 2),
        2021: (117, 1), 2022: (117, 2),
        2023: (118, 1), 2024: (118, 2),
        2025: (119, 1), 2026: (119, 2)
    }

    sessions_to_fetch = set()
    for year in range(start_year, end_year + 1):
        if year in year_to_congress_session:
            sessions_to_fetch.add(year_to_congress_session[year])

    def process_senate_vote(args):
        fetcher, congress, session, vote_number, start_year, end_year = args

        xml_root = fetcher.get_vote_xml(congress, session, vote_number)
        if xml_root is None:
            return None

        vote_data = fetcher.parse_vote(xml_root)

        vote_date = vote_data.get("date", "")
        try:
            dt = datetime.strptime(vote_date.split(",")[0] + "," + vote_date.split(",")[1], "%B %d, %Y")
            vote_year = dt.year
            date_str = dt.strftime("%Y-%m-%d")
        except:
            vote_year = 2020 + congress - 116
            date_str = vote_date

        if vote_year < start_year or vote_year > end_year:
            return None

        members = vote_data.get("members", [])
        party_totals = analyze_party_votes(members)
        flippers = find_party_flippers(members)

        outcome = VoteOutcome(
            result=vote_data.get("result", "Unknown"),
            yea_total=vote_data.get("yeas", 0),
            nay_total=vote_data.get("nays", 0),
            present=vote_data.get("present", 0),
            not_voting=vote_data.get("absent", 0),
            democrat_yea=party_totals["D"]["yea"],
            democrat_nay=party_totals["D"]["nay"],
            republican_yea=party_totals["R"]["yea"],
            republican_nay=party_totals["R"]["nay"],
            independent_yea=party_totals["I"]["yea"],
            independent_nay=party_totals["I"]["nay"],
        )

        xml_url = f"https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{vote_number:05d}.xml"
        sources = [
            {"url": xml_url, "source_type": "xml", "label": "Senate.gov XML"},
            {"url": f"https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{vote_number:05d}.htm", "source_type": "text", "label": "Senate.gov Vote Page"},
        ]

        bill_type = vote_data.get("bill_type", "")
        bill_num = vote_data.get("bill_number", "")
        bill_number = f"{bill_type} {bill_num}" if bill_type and bill_num else None

        key_members = [f"{f['name']} (voted {f['vote']})" for f in flippers[:5]]

        return CongressionalVote(
            vote_id=f"{congress}-senate-{session}-{vote_number}",
            title=vote_data.get("title", "") or vote_data.get("question", "Unknown"),
            chamber="Senate",
            congress=congress,
            session=session,
            roll_call_number=vote_number,
            date=date_str,
            question=vote_data.get("question", ""),
            vote_type=vote_data.get("vote_type", ""),
            result=vote_data.get("result", ""),
            bill_number=bill_number,
            bill_title=vote_data.get("bill_title"),
            sources=sources,
            key_members=key_members,
            outcome=asdict(outcome),
            party_flippers=flippers
        )

    for congress, session in sorted(sessions_to_fetch):
        safe_print(f"\n  Fetching Senate votes for {congress}th Congress, Session {session}...")

        # First, probe to find the max vote number
        max_vote = 1
        probe_step = 100
        while True:
            xml = fetcher.get_vote_xml(congress, session, max_vote + probe_step)
            if xml is None:
                break
            max_vote += probe_step

        # Binary search to find exact max
        low, high = max_vote, max_vote + probe_step
        while low < high:
            mid = (low + high + 1) // 2
            if fetcher.get_vote_xml(congress, session, mid) is not None:
                low = mid
            else:
                high = mid - 1
        max_vote = low

        if max_vote < 1:
            safe_print(f"    No votes found")
            continue

        safe_print(f"    Found up to vote #{max_vote}, processing in parallel...")

        # Process all votes in parallel
        processed = 0
        session_added = 0

        with ThreadPoolExecutor(max_workers=3) as executor:  # Reduced to avoid rate limiting
            futures = []
            for vote_num in range(1, max_vote + 1):
                args = (fetcher, congress, session, vote_num, start_year, end_year)
                futures.append(executor.submit(process_senate_vote, args))

            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        all_votes.append(result)
                        session_added += 1
                        total_added += 1
                    processed += 1
                    if processed % 50 == 0:
                        safe_print(f"    Processed {processed}/{max_vote} votes... (saved {len(all_votes)} total)")
                        save_callback()
                except Exception:
                    processed += 1

        save_callback()
        safe_print(f"    Total Senate votes for {congress}th Congress Session {session}: {session_added}")

    return total_added


def save_to_yaml(votes: List[CongressionalVote], output_path: str, silent: bool = False):
    """Save votes to YAML file"""
    votes_sorted = sorted(votes, key=lambda v: v.date, reverse=True)
    votes_data = [asdict(vote) for vote in votes_sorted]

    output = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_votes": len(votes),
            "house_votes": sum(1 for v in votes if v.chamber == "House"),
            "senate_votes": sum(1 for v in votes if v.chamber == "Senate"),
            "date_range": {
                "start": min(v.date for v in votes) if votes else None,
                "end": max(v.date for v in votes) if votes else None
            },
            "sources": ["Congress.gov API (House)", "Senate.gov XML (Senate)"]
        },
        "votes": votes_data
    }

    with open(output_path, "w") as f:
        yaml.dump(output, f, default_flow_style=False, allow_unicode=True, sort_keys=False, width=120)

    if not silent:
        safe_print(f"\nSaved {len(votes)} votes to {output_path}")


def main():
    api_key = os.environ.get("CONGRESS_API_KEY")
    if api_key:
        api_key = api_key.strip()

    if not api_key:
        print("Error: CONGRESS_API_KEY environment variable not set.", file=sys.stderr)
        print("\nTo get an API key:", file=sys.stderr)
        print("1. Go to https://api.congress.gov/sign-up/", file=sys.stderr)
        print("2. Fill out the form (requires JavaScript enabled)", file=sys.stderr)
        print("3. Check your email for the API key", file=sys.stderr)
        print("4. Set the environment variable:", file=sys.stderr)
        print("   export CONGRESS_API_KEY='your-api-key-here'", file=sys.stderr)
        sys.exit(1)

    print("Congressional Vote Fetcher", file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    print("Fetching votes from 2020-2026...", file=sys.stderr)
    print("Using parallel processing for faster fetching.", file=sys.stderr)
    print("Output file updates live as votes are fetched.", file=sys.stderr)

    start_year = 2020
    end_year = 2026
    all_votes = []
    output_path = "congressional_votes_2020_2026.yaml"
    last_save_count = 0

    def save_progress():
        nonlocal last_save_count
        if len(all_votes) > last_save_count:
            save_to_yaml(all_votes, output_path, silent=True)
            last_save_count = len(all_votes)

    try:
        print("\n[HOUSE VOTES]", file=sys.stderr)
        house_votes = fetch_house_votes_live(api_key, start_year, end_year, all_votes, save_progress)

        print("\n[SENATE VOTES]", file=sys.stderr)
        senate_votes = fetch_senate_votes_live(start_year, end_year, all_votes, save_progress)

        # Final save
        save_to_yaml(all_votes, output_path)

        print(f"\nDone!", file=sys.stderr)
        print(f"  House votes: {house_votes}", file=sys.stderr)
        print(f"  Senate votes: {senate_votes}", file=sys.stderr)
        print(f"  Total: {len(all_votes)}", file=sys.stderr)
        print(f"  Output: {output_path}", file=sys.stderr)

    except KeyboardInterrupt:
        print("\n\nInterrupted. Final save...", file=sys.stderr)
        if all_votes:
            save_to_yaml(all_votes, output_path)
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        if all_votes:
            save_to_yaml(all_votes, output_path)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
