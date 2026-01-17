#!/usr/bin/env python3
"""
Search YouTube for legislator interviews and appearances.

This script supports two modes:
1. YouTube Data API (requires API key) - more reliable, structured results
2. yt-dlp search (no API key needed) - uses YouTube's search directly

For caption extraction, we use yt-dlp which doesn't require an API key.
"""

import json
import subprocess
import time
from pathlib import Path
from typing import Optional
from datetime import datetime

# Official news channel IDs for filtering
NEWS_CHANNELS = {
    "CNN": "UCupvZG-5ko_eiXAupbDfxWw",
    "MSNBC": "UCaXkIU1QidjPwiAYu6GcHjg",
    "Fox News": "UCXIJgqnII2ZOINSWNOGFThA",
    "CBS News": "UC8p1vwvWtl6T73JiExfWs1g",
    "ABC News": "UCBi2mrWuNuyYy4gbM6fU18Q",
    "NBC News": "UCeY0bbntWzzVIaj2z3QigXg",
    "PBS NewsHour": "UC6ZFN9Tx6xh-skXCuRHCDpQ",
    "C-SPAN": "UCb--64Gl51jIEVE-GLDAVTg",
    "NPR": "UC82mWXQlOuO1HNwJbLnD4XA",
    "The Hill": "UCPWXiRWZ29zrxPFIQT7eHSA",
    "Politico": "UC8lMIlV0hx_JRBtzwFcqCHg",
    "Washington Post": "UCHd62-u_v4DvJ8TCFtpi4GA",
    "New York Times": "UCqnbDFdCpuN8CMEg0VuEBqA",
}

# Rate limiting
REQUESTS_PER_MINUTE = 20
REQUEST_DELAY = 60 / REQUESTS_PER_MINUTE


def search_youtube_ytdlp(
    query: str,
    max_results: int = 50,
    date_filter: str = "year",  # hour, today, week, month, year
) -> list[dict]:
    """
    Search YouTube using yt-dlp (no API key required).

    Args:
        query: Search query
        max_results: Maximum number of results
        date_filter: Filter by upload date

    Returns:
        List of video info dicts
    """
    search_url = f"ytsearch{max_results}:{query}"

    cmd = [
        "yt-dlp",
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        search_url,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            print(f"yt-dlp error: {result.stderr}")
            return []

        videos = []
        for line in result.stdout.strip().split("\n"):
            if line:
                try:
                    video = json.loads(line)
                    videos.append({
                        "video_id": video.get("id"),
                        "title": video.get("title"),
                        "url": video.get("url") or f"https://youtube.com/watch?v={video.get('id')}",
                        "channel": video.get("channel"),
                        "channel_id": video.get("channel_id"),
                        "upload_date": video.get("upload_date"),
                        "duration": video.get("duration"),
                        "view_count": video.get("view_count"),
                        "description": video.get("description", "")[:500],
                    })
                except json.JSONDecodeError:
                    continue

        return videos

    except subprocess.TimeoutExpired:
        print("yt-dlp search timed out")
        return []
    except FileNotFoundError:
        print("yt-dlp not found. Install with: pip install yt-dlp")
        return []


def search_youtube_api(
    query: str,
    api_key: str,
    max_results: int = 50,
    published_after: str = "2020-01-01",
    channel_id: Optional[str] = None,
) -> list[dict]:
    """
    Search YouTube using the Data API v3.

    Requires a YouTube Data API key from Google Cloud Console.

    Args:
        query: Search query
        api_key: YouTube Data API key
        max_results: Maximum results (max 50 per request)
        published_after: Filter videos after this date (YYYY-MM-DD)
        channel_id: Optional channel ID to filter

    Returns:
        List of video info dicts
    """
    import requests

    base_url = "https://www.googleapis.com/youtube/v3/search"

    # Convert date to RFC 3339 format
    published_after_rfc = f"{published_after}T00:00:00Z"

    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": min(max_results, 50),
        "publishedAfter": published_after_rfc,
        "order": "relevance",
        "key": api_key,
    }

    if channel_id:
        params["channelId"] = channel_id

    videos = []
    next_page_token = None

    while len(videos) < max_results:
        if next_page_token:
            params["pageToken"] = next_page_token

        response = requests.get(base_url, params=params, timeout=30)

        if response.status_code == 403:
            print("API quota exceeded or invalid API key")
            break

        response.raise_for_status()
        data = response.json()

        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            video_id = item.get("id", {}).get("videoId")

            if video_id:
                videos.append({
                    "video_id": video_id,
                    "title": snippet.get("title"),
                    "url": f"https://youtube.com/watch?v={video_id}",
                    "channel": snippet.get("channelTitle"),
                    "channel_id": snippet.get("channelId"),
                    "upload_date": snippet.get("publishedAt", "")[:10].replace("-", ""),
                    "description": snippet.get("description", "")[:500],
                    "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url"),
                })

        next_page_token = data.get("nextPageToken")
        if not next_page_token:
            break

        time.sleep(REQUEST_DELAY)

    return videos[:max_results]


def search_legislator_youtube(
    name: str,
    bioguide_id: str,
    max_results: int = 100,
    api_key: Optional[str] = None,
    published_after: str = "2020-01-01",
    search_news_channels: bool = True,
) -> dict:
    """
    Search YouTube for a legislator's appearances.

    Args:
        name: Full name of the legislator
        bioguide_id: Unique identifier
        max_results: Max total results
        api_key: Optional YouTube API key
        published_after: Filter videos after this date
        search_news_channels: Whether to search specific news channels

    Returns:
        Dict with legislator info and video results
    """
    print(f"Searching YouTube for: {name}")

    all_videos = []

    # Search terms to try
    search_queries = [
        f'"{name}" interview',
        f'"{name}" hearing',
        f'"{name}" speech',
    ]

    if api_key:
        # Use API for more reliable results
        for query in search_queries:
            videos = search_youtube_api(
                query=query,
                api_key=api_key,
                max_results=max_results // len(search_queries),
                published_after=published_after,
            )
            all_videos.extend(videos)
            time.sleep(REQUEST_DELAY)

            if search_news_channels:
                # Also search specific news channels
                for channel_name, channel_id in list(NEWS_CHANNELS.items())[:5]:
                    channel_videos = search_youtube_api(
                        query=name,
                        api_key=api_key,
                        max_results=10,
                        published_after=published_after,
                        channel_id=channel_id,
                    )
                    all_videos.extend(channel_videos)
                    time.sleep(REQUEST_DELAY)
    else:
        # Use yt-dlp (no API key needed)
        for query in search_queries:
            videos = search_youtube_ytdlp(
                query=query,
                max_results=max_results // len(search_queries),
            )
            all_videos.extend(videos)
            time.sleep(REQUEST_DELAY)

    # Deduplicate by video_id
    seen = set()
    unique_videos = []
    for video in all_videos:
        vid = video.get("video_id")
        if vid and vid not in seen:
            seen.add(vid)
            unique_videos.append(video)

    # Filter to likely news/political content
    filtered_videos = []
    for video in unique_videos:
        title_lower = (video.get("title") or "").lower()
        channel_lower = (video.get("channel") or "").lower()

        # Check if it's from a known news source or has relevant keywords
        is_news = any(news.lower() in channel_lower for news in NEWS_CHANNELS.keys())
        has_keywords = any(kw in title_lower for kw in [
            "interview", "hearing", "speech", "senate", "house",
            "congress", "committee", "news", "politics", "cnn",
            "msnbc", "fox", "cbs", "nbc", "abc", "pbs", "c-span"
        ])

        if is_news or has_keywords:
            filtered_videos.append(video)

    return {
        "bioguide_id": bioguide_id,
        "name": name,
        "total_found": len(unique_videos),
        "filtered_count": len(filtered_videos),
        "search_params": {
            "published_after": published_after,
            "used_api": api_key is not None,
        },
        "videos": filtered_videos[:max_results],
    }


def batch_search_legislators_youtube(
    legislators: list[dict],
    max_results_per_legislator: int = 50,
    api_key: Optional[str] = None,
    published_after: str = "2020-01-01",
    output_dir: Optional[Path] = None,
) -> list[dict]:
    """
    Search YouTube for multiple legislators.
    """
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for i, leg in enumerate(legislators):
        print(f"\n[{i+1}/{len(legislators)}] Processing {leg['name']}...")

        try:
            result = search_legislator_youtube(
                name=leg["name"],
                bioguide_id=leg["bioguide_id"],
                max_results=max_results_per_legislator,
                api_key=api_key,
                published_after=published_after,
            )
            results.append(result)

            if output_dir:
                output_file = output_dir / f"{leg['bioguide_id']}_youtube.json"
                with open(output_file, "w") as f:
                    json.dump(result, f, indent=2)

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({
                "bioguide_id": leg["bioguide_id"],
                "name": leg["name"],
                "error": str(e),
            })

        time.sleep(REQUEST_DELAY * 2)  # Extra delay for YouTube

    return results


if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Search YouTube for legislators")
    parser.add_argument("--name", type=str, help="Legislator name to search")
    parser.add_argument("--bioguide", type=str, default="", help="Bioguide ID")
    parser.add_argument("--api-key", type=str, default=os.environ.get("YOUTUBE_API_KEY"),
                        help="YouTube Data API key (or set YOUTUBE_API_KEY env var)")
    parser.add_argument("--max-results", type=int, default=50)
    parser.add_argument("--published-after", type=str, default="2020-01-01")
    parser.add_argument("-o", "--output", type=Path, help="Output JSON file")

    args = parser.parse_args()

    if args.name:
        result = search_legislator_youtube(
            name=args.name,
            bioguide_id=args.bioguide or args.name.replace(" ", "_"),
            max_results=args.max_results,
            api_key=args.api_key,
            published_after=args.published_after,
        )

        print(f"\nFound {result['total_found']} total videos")
        print(f"Filtered to {result['filtered_count']} relevant videos")

        if args.output:
            with open(args.output, "w") as f:
                json.dump(result, f, indent=2)
            print(f"Saved to {args.output}")
        else:
            # Print first few results
            for video in result["videos"][:5]:
                print(f"\n  - {video['title']}")
                print(f"    Channel: {video['channel']}")
                print(f"    URL: {video['url']}")
    else:
        print("Usage: python search_youtube.py --name 'Bernie Sanders'")
        print("       python search_youtube.py --name 'Bernie Sanders' --api-key YOUR_KEY")
