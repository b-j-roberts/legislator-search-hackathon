#!/usr/bin/env python3
"""
Fetch current legislators from the unitedstates/congress-legislators repo.
"""

import yaml
import json
import requests
from pathlib import Path
from typing import Optional

LEGISLATORS_URL = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml"


def fetch_legislators(output_path: Optional[Path] = None) -> list[dict]:
    """
    Fetch current legislators and return structured data.

    Returns list of dicts with:
        - bioguide_id: Unique identifier
        - name: Full name
        - first_name, last_name
        - state: Two-letter state code
        - party: Democrat, Republican, Independent
        - chamber: senate or house
        - district: For representatives (None for senators)
    """
    print("Fetching legislators from congress-legislators repo...")
    response = requests.get(LEGISLATORS_URL, timeout=30)
    response.raise_for_status()

    raw_legislators = yaml.safe_load(response.text)

    legislators = []
    for leg in raw_legislators:
        # Get current term
        current_term = leg.get("terms", [{}])[-1]

        name_info = leg.get("name", {})
        full_name = name_info.get("official_full",
                                   f"{name_info.get('first', '')} {name_info.get('last', '')}")

        legislators.append({
            "bioguide_id": leg.get("id", {}).get("bioguide"),
            "name": full_name.strip(),
            "first_name": name_info.get("first", ""),
            "last_name": name_info.get("last", ""),
            "state": current_term.get("state", ""),
            "party": current_term.get("party", ""),
            "chamber": "senate" if current_term.get("type") == "sen" else "house",
            "district": current_term.get("district"),
        })

    print(f"Found {len(legislators)} current legislators")
    print(f"  - Senators: {sum(1 for l in legislators if l['chamber'] == 'senate')}")
    print(f"  - Representatives: {sum(1 for l in legislators if l['chamber'] == 'house')}")

    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(legislators, f, indent=2)
        print(f"Saved to {output_path}")

    return legislators


def load_legislators(path: Path) -> list[dict]:
    """Load legislators from local JSON file."""
    with open(path) as f:
        return json.load(f)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fetch current legislators")
    parser.add_argument("-o", "--output", type=Path,
                        default=Path("data/legislators.json"),
                        help="Output path for legislators JSON")
    args = parser.parse_args()

    # Make path relative to video-processing dir
    script_dir = Path(__file__).parent.parent
    output_path = script_dir / args.output

    fetch_legislators(output_path)
