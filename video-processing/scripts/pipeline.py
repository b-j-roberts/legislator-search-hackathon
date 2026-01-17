#!/usr/bin/env python3
"""
Main pipeline for processing legislator media appearances.

This script orchestrates:
1. Fetching legislators list
2. Searching Internet Archive TV News
3. Searching YouTube
4. Extracting transcripts
5. Saving structured output
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional

from fetch_legislators import fetch_legislators, load_legislators
from search_internet_archive import batch_search_legislators, search_legislator
from search_youtube import batch_search_legislators_youtube, search_legislator_youtube
from extract_transcripts import (
    batch_extract_ia_transcripts,
    batch_extract_youtube_transcripts,
)


def run_pipeline(
    legislators: list[dict],
    output_dir: Path,
    start_date: str = "2020-01-01",
    end_date: str = "2026-12-31",
    max_ia_results: int = 100,
    max_youtube_results: int = 50,
    youtube_api_key: Optional[str] = None,
    extract_transcripts: bool = False,
    skip_ia: bool = False,
    skip_youtube: bool = False,
) -> dict:
    """
    Run the full pipeline for a list of legislators.

    Args:
        legislators: List of legislator dicts
        output_dir: Base output directory
        start_date: Start date for searches
        end_date: End date for searches
        max_ia_results: Max Internet Archive results per legislator
        max_youtube_results: Max YouTube results per legislator
        youtube_api_key: Optional YouTube API key
        extract_transcripts: Whether to extract transcripts
        skip_ia: Skip Internet Archive search
        skip_youtube: Skip YouTube search

    Returns:
        Summary dict with statistics
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create subdirectories
    ia_dir = output_dir / "internet_archive"
    youtube_dir = output_dir / "youtube"
    transcripts_dir = output_dir / "transcripts"

    summary = {
        "run_date": datetime.now().isoformat(),
        "legislators_processed": len(legislators),
        "date_range": {"start": start_date, "end": end_date},
        "internet_archive": {"total_appearances": 0, "legislators_with_results": 0},
        "youtube": {"total_videos": 0, "legislators_with_results": 0},
        "transcripts": {"extracted": 0, "failed": 0},
    }

    # ========================================================================
    # Step 1: Search Internet Archive
    # ========================================================================
    if not skip_ia:
        print("\n" + "=" * 60)
        print("STEP 1: Searching Internet Archive TV News")
        print("=" * 60)

        ia_results = batch_search_legislators(
            legislators=legislators,
            start_date=start_date,
            end_date=end_date,
            max_results_per_legislator=max_ia_results,
            output_dir=ia_dir,
        )

        for result in ia_results:
            if "appearances" in result:
                summary["internet_archive"]["total_appearances"] += len(result["appearances"])
                if result["appearances"]:
                    summary["internet_archive"]["legislators_with_results"] += 1

        # Save combined results
        with open(ia_dir / "all_results.json", "w") as f:
            json.dump(ia_results, f, indent=2)

    # ========================================================================
    # Step 2: Search YouTube
    # ========================================================================
    if not skip_youtube:
        print("\n" + "=" * 60)
        print("STEP 2: Searching YouTube")
        print("=" * 60)

        youtube_results = batch_search_legislators_youtube(
            legislators=legislators,
            max_results_per_legislator=max_youtube_results,
            api_key=youtube_api_key,
            published_after=start_date,
            output_dir=youtube_dir,
        )

        for result in youtube_results:
            if "videos" in result:
                summary["youtube"]["total_videos"] += len(result["videos"])
                if result["videos"]:
                    summary["youtube"]["legislators_with_results"] += 1

        # Save combined results
        with open(youtube_dir / "all_results.json", "w") as f:
            json.dump(youtube_results, f, indent=2)

    # ========================================================================
    # Step 3: Extract Transcripts (optional)
    # ========================================================================
    if extract_transcripts:
        print("\n" + "=" * 60)
        print("STEP 3: Extracting Transcripts")
        print("=" * 60)

        ia_transcripts_dir = transcripts_dir / "internet_archive"
        youtube_transcripts_dir = transcripts_dir / "youtube"

        # Extract IA transcripts
        if not skip_ia and (ia_dir / "all_results.json").exists():
            with open(ia_dir / "all_results.json") as f:
                ia_results = json.load(f)

            all_appearances = []
            for result in ia_results:
                all_appearances.extend(result.get("appearances", [])[:10])  # Limit per legislator

            if all_appearances:
                ia_transcript_results = batch_extract_ia_transcripts(
                    all_appearances[:100],  # Limit total
                    ia_transcripts_dir,
                )
                for r in ia_transcript_results:
                    if r["success"]:
                        summary["transcripts"]["extracted"] += 1
                    else:
                        summary["transcripts"]["failed"] += 1

        # Extract YouTube transcripts
        if not skip_youtube and (youtube_dir / "all_results.json").exists():
            with open(youtube_dir / "all_results.json") as f:
                youtube_results = json.load(f)

            all_videos = []
            for result in youtube_results:
                all_videos.extend(result.get("videos", [])[:10])  # Limit per legislator

            if all_videos:
                youtube_transcript_results = batch_extract_youtube_transcripts(
                    all_videos[:100],  # Limit total
                    youtube_transcripts_dir,
                )
                for r in youtube_transcript_results:
                    if r["success"]:
                        summary["transcripts"]["extracted"] += 1
                    else:
                        summary["transcripts"]["failed"] += 1

    # ========================================================================
    # Save Summary
    # ========================================================================
    with open(output_dir / "pipeline_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Legislators processed: {summary['legislators_processed']}")
    print(f"Internet Archive appearances: {summary['internet_archive']['total_appearances']}")
    print(f"YouTube videos: {summary['youtube']['total_videos']}")
    if extract_transcripts:
        print(f"Transcripts extracted: {summary['transcripts']['extracted']}")
    print(f"\nOutput saved to: {output_dir}")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Process legislator media appearances",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process all legislators (full run)
  python pipeline.py --all

  # Process only senators
  python pipeline.py --chamber senate

  # Process specific legislators
  python pipeline.py --names "Bernie Sanders" "Mitch McConnell"

  # Process with transcript extraction
  python pipeline.py --names "Bernie Sanders" --extract-transcripts

  # Quick test with one legislator
  python pipeline.py --names "Bernie Sanders" --max-ia 10 --max-youtube 10
        """,
    )

    # Legislator selection
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--all", action="store_true", help="Process all legislators")
    group.add_argument("--chamber", choices=["senate", "house"], help="Process one chamber")
    group.add_argument("--names", nargs="+", help="Specific legislator names")
    group.add_argument("--bioguides", nargs="+", help="Specific bioguide IDs")
    group.add_argument("--legislators-file", type=Path, help="JSON file with legislators")

    # Date range
    parser.add_argument("--start-date", type=str, default="2020-01-01")
    parser.add_argument("--end-date", type=str, default="2026-12-31")

    # Result limits
    parser.add_argument("--max-ia", type=int, default=100, help="Max IA results per legislator")
    parser.add_argument("--max-youtube", type=int, default=50, help="Max YouTube results per legislator")

    # API keys
    parser.add_argument("--youtube-api-key", type=str, help="YouTube Data API key")

    # Options
    parser.add_argument("--extract-transcripts", action="store_true", help="Extract transcripts")
    parser.add_argument("--skip-ia", action="store_true", help="Skip Internet Archive")
    parser.add_argument("--skip-youtube", action="store_true", help="Skip YouTube")

    # Output
    parser.add_argument("-o", "--output", type=Path, default=Path("data/pipeline_output"),
                        help="Output directory")

    args = parser.parse_args()

    # Determine script directory for relative paths
    script_dir = Path(__file__).parent.parent
    output_dir = script_dir / args.output

    # ========================================================================
    # Load or fetch legislators
    # ========================================================================
    legislators_cache = script_dir / "data" / "legislators.json"

    if args.legislators_file:
        legislators = load_legislators(args.legislators_file)
    elif legislators_cache.exists():
        print(f"Loading cached legislators from {legislators_cache}")
        legislators = load_legislators(legislators_cache)
    else:
        legislators = fetch_legislators(legislators_cache)

    # Filter legislators based on arguments
    if args.chamber:
        legislators = [l for l in legislators if l["chamber"] == args.chamber]
        print(f"Filtered to {len(legislators)} {args.chamber} members")
    elif args.names:
        name_set = set(n.lower() for n in args.names)
        legislators = [l for l in legislators if l["name"].lower() in name_set]
        print(f"Filtered to {len(legislators)} legislators by name")
    elif args.bioguides:
        bioguide_set = set(args.bioguides)
        legislators = [l for l in legislators if l["bioguide_id"] in bioguide_set]
        print(f"Filtered to {len(legislators)} legislators by bioguide ID")
    elif not args.all:
        # Default: just do a sample
        print("No selection specified. Use --all for all legislators or --names/--chamber to filter.")
        print("Running with first 5 legislators as demo...")
        legislators = legislators[:5]

    if not legislators:
        print("No legislators to process!")
        return

    # ========================================================================
    # Run pipeline
    # ========================================================================
    import os
    youtube_api_key = args.youtube_api_key or os.environ.get("YOUTUBE_API_KEY")

    run_pipeline(
        legislators=legislators,
        output_dir=output_dir,
        start_date=args.start_date,
        end_date=args.end_date,
        max_ia_results=args.max_ia,
        max_youtube_results=args.max_youtube,
        youtube_api_key=youtube_api_key,
        extract_transcripts=args.extract_transcripts,
        skip_ia=args.skip_ia,
        skip_youtube=args.skip_youtube,
    )


if __name__ == "__main__":
    main()
