#!/usr/bin/env python3
"""
Cleanup and merge congressional hearings data.

This script:
1. Deduplicates hearing entries (keeps most complete version)
2. Merges re-fetched data (e.g., 117th Congress with witness data)
3. Validates and reports on data quality

Usage:
    python cleanup_hearings.py --input congressional_hearings_2020_2026.yaml --output congressional_hearings_cleaned.yaml
    python cleanup_hearings.py --input main.yaml --merge refetch.yaml --output cleaned.yaml
"""

import argparse
import yaml
from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import defaultdict


def count_non_null_fields(hearing: Dict) -> int:
    """Count the number of non-null, non-empty fields in a hearing."""
    count = 0
    for key, value in hearing.items():
        if value is not None:
            if isinstance(value, list):
                if len(value) > 0:
                    count += 1
            elif isinstance(value, str):
                if value.strip():
                    count += 1
            else:
                count += 1
    return count


def get_hearing_key(hearing: Dict) -> tuple:
    """Generate a unique key for a hearing based on identifying fields."""
    return (
        hearing.get('title', ''),
        hearing.get('date', ''),
        hearing.get('congress', 0),
        hearing.get('chamber', ''),
        hearing.get('committee', '') or hearing.get('subcommittee', '')
    )


def merge_hearings(primary: Dict, secondary: Dict) -> Dict:
    """Merge two hearing records, preferring non-null values from primary."""
    merged = primary.copy()

    for key, value in secondary.items():
        if key not in merged or merged[key] is None:
            merged[key] = value
        elif isinstance(value, list) and isinstance(merged[key], list):
            # For lists, prefer the longer one (more data)
            if len(value) > len(merged[key]):
                merged[key] = value
        elif merged[key] is None and value is not None:
            merged[key] = value

    return merged


def deduplicate_hearings(hearings: List[Dict], verbose: bool = True) -> List[Dict]:
    """Remove duplicate hearings, keeping the most complete version."""
    seen = {}
    duplicates_found = 0

    for hearing in hearings:
        key = get_hearing_key(hearing)

        if key in seen:
            duplicates_found += 1
            existing = seen[key]
            # Keep the one with more data, or merge them
            existing_score = count_non_null_fields(existing)
            new_score = count_non_null_fields(hearing)

            if new_score > existing_score:
                # New one is more complete, but merge to get best of both
                seen[key] = merge_hearings(hearing, existing)
            else:
                # Existing is more complete, but merge to get best of both
                seen[key] = merge_hearings(existing, hearing)
        else:
            seen[key] = hearing

    if verbose:
        print(f"  Duplicates found and merged: {duplicates_found}")

    return list(seen.values())


def merge_yaml_files(primary_path: str, secondary_path: str) -> List[Dict]:
    """Merge hearings from two YAML files, with secondary providing updates."""
    print(f"Loading primary file: {primary_path}")
    with open(primary_path, 'r') as f:
        primary_data = yaml.safe_load(f)

    print(f"Loading secondary file: {secondary_path}")
    with open(secondary_path, 'r') as f:
        secondary_data = yaml.safe_load(f)

    primary_hearings = primary_data.get('hearings', [])
    secondary_hearings = secondary_data.get('hearings', [])

    print(f"  Primary hearings: {len(primary_hearings)}")
    print(f"  Secondary hearings: {len(secondary_hearings)}")

    # Create a lookup from secondary data
    secondary_lookup = {}
    for hearing in secondary_hearings:
        key = get_hearing_key(hearing)
        secondary_lookup[key] = hearing

    # Merge: update primary with secondary data where available
    merged = []
    updated_count = 0

    for hearing in primary_hearings:
        key = get_hearing_key(hearing)
        if key in secondary_lookup:
            # Merge the two, preferring secondary (newer fetch) for non-null values
            merged_hearing = merge_hearings(secondary_lookup[key], hearing)
            merged.append(merged_hearing)
            updated_count += 1
        else:
            merged.append(hearing)

    # Add any hearings from secondary that weren't in primary
    primary_keys = {get_hearing_key(h) for h in primary_hearings}
    new_count = 0
    for hearing in secondary_hearings:
        key = get_hearing_key(hearing)
        if key not in primary_keys:
            merged.append(hearing)
            new_count += 1

    print(f"  Updated from secondary: {updated_count}")
    print(f"  New from secondary: {new_count}")

    return merged


def validate_hearings(hearings: List[Dict]) -> Dict[str, Any]:
    """Validate hearings and return statistics."""
    stats = {
        'total': len(hearings),
        'with_witnesses': 0,
        'with_members': 0,
        'with_sources': 0,
        'with_related_bills': 0,
        'with_location': 0,
        'by_congress': defaultdict(lambda: {'total': 0, 'with_witnesses': 0}),
        'by_year': defaultdict(lambda: {'total': 0, 'with_witnesses': 0}),
        'missing_date': 0,
        'missing_title': 0,
    }

    for h in hearings:
        congress = h.get('congress', 0)
        date = h.get('date', '')
        year = date[:4] if date else 'Unknown'

        stats['by_congress'][congress]['total'] += 1
        stats['by_year'][year]['total'] += 1

        if h.get('witnesses') and len(h.get('witnesses', [])) > 0:
            stats['with_witnesses'] += 1
            stats['by_congress'][congress]['with_witnesses'] += 1
            stats['by_year'][year]['with_witnesses'] += 1

        if h.get('members') and len(h.get('members', [])) > 0:
            stats['with_members'] += 1

        if h.get('sources') and len(h.get('sources', [])) > 0:
            stats['with_sources'] += 1

        if h.get('related_bills') and len(h.get('related_bills', [])) > 0:
            stats['with_related_bills'] += 1

        if h.get('location'):
            stats['with_location'] += 1

        if not date:
            stats['missing_date'] += 1

        if not h.get('title'):
            stats['missing_title'] += 1

    return stats


def print_stats(stats: Dict[str, Any]):
    """Print statistics in a readable format."""
    total = stats['total']

    print(f"\n{'=' * 50}")
    print("Data Quality Report")
    print(f"{'=' * 50}")

    print(f"\nTotal hearings: {total}")
    print(f"\nField Coverage:")
    print(f"  With witnesses:     {stats['with_witnesses']:>5} ({100*stats['with_witnesses']/total:.1f}%)")
    print(f"  With members:       {stats['with_members']:>5} ({100*stats['with_members']/total:.1f}%)")
    print(f"  With sources:       {stats['with_sources']:>5} ({100*stats['with_sources']/total:.1f}%)")
    print(f"  With related bills: {stats['with_related_bills']:>5} ({100*stats['with_related_bills']/total:.1f}%)")
    print(f"  With location:      {stats['with_location']:>5} ({100*stats['with_location']/total:.1f}%)")

    print(f"\nBy Congress:")
    for congress in sorted(stats['by_congress'].keys()):
        data = stats['by_congress'][congress]
        pct = 100*data['with_witnesses']/data['total'] if data['total'] > 0 else 0
        print(f"  {congress}th: {data['total']:>5} hearings, {data['with_witnesses']:>5} with witnesses ({pct:.0f}%)")

    print(f"\nBy Year:")
    for year in sorted(stats['by_year'].keys()):
        data = stats['by_year'][year]
        pct = 100*data['with_witnesses']/data['total'] if data['total'] > 0 else 0
        print(f"  {year}: {data['total']:>5} hearings, {data['with_witnesses']:>5} with witnesses ({pct:.0f}%)")

    if stats['missing_date'] > 0:
        print(f"\nWarnings:")
        print(f"  Missing date: {stats['missing_date']}")
    if stats['missing_title'] > 0:
        print(f"  Missing title: {stats['missing_title']}")


def save_yaml(hearings: List[Dict], output_path: str, source_files: List[str]):
    """Save hearings to YAML file with updated metadata."""
    # Sort by date (most recent first)
    sorted_hearings = sorted(
        hearings,
        key=lambda h: h.get('date') or '0000-00-00',
        reverse=True
    )

    output_data = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'date_range': {
                'start': '2020-01-01',
                'end': '2026-12-31'
            },
            'congresses': [116, 117, 118, 119],
            'total_hearings': len(sorted_hearings),
            'status': 'complete',
            'source': 'Congress.gov API (api.congress.gov)',
            'cleaned': True,
            'source_files': source_files
        },
        'hearings': sorted_hearings
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        yaml.dump(
            output_data,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=120
        )

    print(f"\nOutput written to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Cleanup and merge congressional hearings data')
    parser.add_argument('--input', required=True, help='Primary input YAML file')
    parser.add_argument('--merge', help='Secondary YAML file to merge (optional)')
    parser.add_argument('--output', required=True, help='Output YAML file')
    parser.add_argument('--no-dedup', action='store_true', help='Skip deduplication')
    args = parser.parse_args()

    print("=" * 50)
    print("Congressional Hearings Cleanup Tool")
    print("=" * 50)

    source_files = [args.input]

    if args.merge:
        # Merge two files
        print(f"\nMerging files...")
        hearings = merge_yaml_files(args.input, args.merge)
        source_files.append(args.merge)
    else:
        # Load single file
        print(f"\nLoading: {args.input}")
        with open(args.input, 'r') as f:
            data = yaml.safe_load(f)
        hearings = data.get('hearings', [])
        print(f"  Loaded {len(hearings)} hearings")

    # Deduplicate
    if not args.no_dedup:
        print(f"\nDeduplicating...")
        original_count = len(hearings)
        hearings = deduplicate_hearings(hearings)
        print(f"  {original_count} -> {len(hearings)} hearings")

    # Validate and report
    stats = validate_hearings(hearings)
    print_stats(stats)

    # Save
    save_yaml(hearings, args.output, source_files)

    print("\nDone!")


if __name__ == '__main__':
    main()
