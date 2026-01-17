#!/usr/bin/env python3
"""
Extract transcripts from video sources.

Supports:
1. Internet Archive TV News - captions available via API
2. YouTube - auto-captions via yt-dlp
3. Local audio/video files - transcription via Whisper
"""

import json
import subprocess
import tempfile
import requests
from pathlib import Path
from typing import Optional
import re

# ============================================================================
# Internet Archive Transcript Extraction
# ============================================================================

def get_ia_transcript(identifier: str) -> Optional[dict]:
    """
    Fetch transcript/captions from Internet Archive TV clip.

    The TV Archive stores captions in various formats:
    - .cc5.txt - Plain text captions
    - .srt - SubRip subtitle format
    - .vtt - WebVTT format

    Args:
        identifier: Internet Archive item identifier

    Returns:
        Dict with 'text' (full transcript), 'format', and 'segments' if available
    """
    # Try different caption formats
    formats = [
        (".cc5.txt", "plain"),
        (".cc.txt", "plain"),
        (".srt", "srt"),
        (".vtt", "vtt"),
    ]

    for ext, fmt in formats:
        url = f"https://archive.org/download/{identifier}/{identifier}{ext}"
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                text = response.text

                if fmt == "plain":
                    return {
                        "format": "plain",
                        "text": text,
                        "source_url": url,
                    }
                elif fmt == "srt":
                    return parse_srt(text, url)
                elif fmt == "vtt":
                    return parse_vtt(text, url)

        except requests.RequestException:
            continue

    return None


def parse_srt(content: str, source_url: str) -> dict:
    """Parse SRT subtitle format into structured transcript."""
    segments = []
    full_text = []

    # SRT format: index, timestamp, text, blank line
    blocks = content.strip().split("\n\n")

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) >= 3:
            # lines[0] is index, lines[1] is timestamp, rest is text
            timestamp = lines[1]
            text = " ".join(lines[2:])

            # Parse timestamp: 00:00:00,000 --> 00:00:02,500
            match = re.match(r"(\d{2}:\d{2}:\d{2}),\d+ --> (\d{2}:\d{2}:\d{2}),\d+", timestamp)
            if match:
                start, end = match.groups()
                segments.append({
                    "start": start,
                    "end": end,
                    "text": text,
                })
                full_text.append(text)

    return {
        "format": "srt",
        "text": " ".join(full_text),
        "segments": segments,
        "source_url": source_url,
    }


def parse_vtt(content: str, source_url: str) -> dict:
    """Parse WebVTT subtitle format into structured transcript."""
    segments = []
    full_text = []

    # Skip header
    lines = content.strip().split("\n")
    i = 0
    while i < len(lines) and not re.match(r"\d{2}:\d{2}", lines[i]):
        i += 1

    while i < len(lines):
        line = lines[i].strip()

        # Look for timestamp line
        match = re.match(r"(\d{2}:\d{2}:\d{2}\.\d+) --> (\d{2}:\d{2}:\d{2}\.\d+)", line)
        if match:
            start, end = match.groups()
            i += 1

            # Collect text lines until empty line or next timestamp
            text_lines = []
            while i < len(lines) and lines[i].strip() and not re.match(r"\d{2}:\d{2}", lines[i]):
                text_lines.append(lines[i].strip())
                i += 1

            text = " ".join(text_lines)
            if text:
                segments.append({
                    "start": start,
                    "end": end,
                    "text": text,
                })
                full_text.append(text)
        else:
            i += 1

    return {
        "format": "vtt",
        "text": " ".join(full_text),
        "segments": segments,
        "source_url": source_url,
    }


# ============================================================================
# YouTube Transcript Extraction
# ============================================================================

def get_youtube_transcript(video_id: str, output_dir: Optional[Path] = None) -> Optional[dict]:
    """
    Extract transcript/captions from YouTube video using yt-dlp.

    Args:
        video_id: YouTube video ID
        output_dir: Optional directory to save subtitle files

    Returns:
        Dict with transcript text and metadata
    """
    url = f"https://youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = f"{tmpdir}/%(id)s.%(ext)s"

        # First, try to get auto-generated subtitles
        cmd = [
            "yt-dlp",
            "--write-auto-sub",
            "--sub-lang", "en",
            "--sub-format", "vtt",
            "--skip-download",
            "--output", output_template,
            url,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
            )

            # Look for downloaded subtitle file
            vtt_files = list(Path(tmpdir).glob("*.vtt"))

            if vtt_files:
                vtt_file = vtt_files[0]
                content = vtt_file.read_text()

                transcript = parse_vtt(content, url)
                transcript["video_id"] = video_id

                if output_dir:
                    output_dir.mkdir(parents=True, exist_ok=True)
                    output_file = output_dir / f"{video_id}.vtt"
                    output_file.write_text(content)
                    transcript["local_file"] = str(output_file)

                return transcript

            # If no auto-subs, try manual subtitles
            cmd[1] = "--write-sub"
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            vtt_files = list(Path(tmpdir).glob("*.vtt"))
            if vtt_files:
                vtt_file = vtt_files[0]
                content = vtt_file.read_text()
                transcript = parse_vtt(content, url)
                transcript["video_id"] = video_id
                return transcript

        except subprocess.TimeoutExpired:
            print(f"Timeout extracting subtitles for {video_id}")
        except FileNotFoundError:
            print("yt-dlp not found. Install with: pip install yt-dlp")

    return None


def get_youtube_transcript_api(video_id: str) -> Optional[dict]:
    """
    Extract transcript using youtube-transcript-api (alternative method).

    Requires: pip install youtube-transcript-api
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)

        segments = []
        full_text = []

        for entry in transcript_list:
            segments.append({
                "start": entry["start"],
                "duration": entry["duration"],
                "text": entry["text"],
            })
            full_text.append(entry["text"])

        return {
            "format": "youtube_api",
            "video_id": video_id,
            "text": " ".join(full_text),
            "segments": segments,
        }

    except ImportError:
        print("youtube-transcript-api not installed. Install with: pip install youtube-transcript-api")
        return None
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return None


# ============================================================================
# Whisper Transcription (for audio/video without captions)
# ============================================================================

def transcribe_with_whisper(
    audio_path: Path,
    model: str = "base",
    language: str = "en",
) -> Optional[dict]:
    """
    Transcribe audio/video file using OpenAI Whisper.

    Requires: pip install openai-whisper

    Args:
        audio_path: Path to audio or video file
        model: Whisper model size (tiny, base, small, medium, large)
        language: Language code

    Returns:
        Dict with transcript and segments
    """
    try:
        import whisper

        print(f"Loading Whisper model: {model}")
        model_instance = whisper.load_model(model)

        print(f"Transcribing: {audio_path}")
        result = model_instance.transcribe(
            str(audio_path),
            language=language,
            verbose=False,
        )

        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip(),
            })

        return {
            "format": "whisper",
            "model": model,
            "language": result.get("language"),
            "text": result["text"],
            "segments": segments,
            "source_file": str(audio_path),
        }

    except ImportError:
        print("Whisper not installed. Install with: pip install openai-whisper")
        return None
    except Exception as e:
        print(f"Whisper transcription error: {e}")
        return None


def download_and_transcribe_youtube(
    video_id: str,
    output_dir: Path,
    whisper_model: str = "base",
) -> Optional[dict]:
    """
    Download YouTube audio and transcribe with Whisper.

    Use this when auto-captions are not available.
    """
    url = f"https://youtube.com/watch?v={video_id}"
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_path = output_dir / f"{video_id}.mp3"

    # Download audio only
    cmd = [
        "yt-dlp",
        "-x",  # Extract audio
        "--audio-format", "mp3",
        "--output", str(audio_path.with_suffix(".%(ext)s")),
        url,
    ]

    try:
        subprocess.run(cmd, capture_output=True, timeout=300)

        if audio_path.exists():
            return transcribe_with_whisper(audio_path, model=whisper_model)

    except Exception as e:
        print(f"Error downloading/transcribing: {e}")

    return None


# ============================================================================
# Batch Processing
# ============================================================================

def batch_extract_ia_transcripts(
    appearances: list[dict],
    output_dir: Path,
) -> list[dict]:
    """
    Extract transcripts for multiple Internet Archive clips.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []

    for i, item in enumerate(appearances):
        identifier = item.get("identifier")
        print(f"[{i+1}/{len(appearances)}] Extracting: {identifier}")

        transcript = get_ia_transcript(identifier)

        if transcript:
            transcript["identifier"] = identifier
            transcript["metadata"] = item

            # Save to file
            output_file = output_dir / f"{identifier}.json"
            with open(output_file, "w") as f:
                json.dump(transcript, f, indent=2)

            results.append({
                "identifier": identifier,
                "success": True,
                "file": str(output_file),
                "text_length": len(transcript.get("text", "")),
            })
        else:
            results.append({
                "identifier": identifier,
                "success": False,
                "error": "No captions found",
            })

    return results


def batch_extract_youtube_transcripts(
    videos: list[dict],
    output_dir: Path,
    use_whisper_fallback: bool = False,
    whisper_model: str = "base",
) -> list[dict]:
    """
    Extract transcripts for multiple YouTube videos.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []

    for i, video in enumerate(videos):
        video_id = video.get("video_id")
        print(f"[{i+1}/{len(videos)}] Extracting: {video_id}")

        # Try caption extraction first
        transcript = get_youtube_transcript(video_id, output_dir)

        if not transcript and use_whisper_fallback:
            print(f"  No captions, trying Whisper...")
            transcript = download_and_transcribe_youtube(
                video_id, output_dir, whisper_model
            )

        if transcript:
            transcript["metadata"] = video

            # Save to file
            output_file = output_dir / f"{video_id}.json"
            with open(output_file, "w") as f:
                json.dump(transcript, f, indent=2)

            results.append({
                "video_id": video_id,
                "success": True,
                "file": str(output_file),
                "text_length": len(transcript.get("text", "")),
            })
        else:
            results.append({
                "video_id": video_id,
                "success": False,
                "error": "No transcript available",
            })

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Extract transcripts from videos")
    parser.add_argument("--source", choices=["ia", "youtube", "whisper"], required=True)
    parser.add_argument("--id", type=str, help="Video/item identifier")
    parser.add_argument("--file", type=Path, help="Local file for Whisper")
    parser.add_argument("-o", "--output", type=Path, help="Output directory")
    parser.add_argument("--whisper-model", type=str, default="base")

    args = parser.parse_args()

    if args.source == "ia" and args.id:
        result = get_ia_transcript(args.id)
        if result:
            print(f"Format: {result['format']}")
            print(f"Text length: {len(result['text'])} chars")
            print(f"\nFirst 500 chars:\n{result['text'][:500]}")
        else:
            print("No transcript found")

    elif args.source == "youtube" and args.id:
        result = get_youtube_transcript(args.id, args.output)
        if result:
            print(f"Format: {result['format']}")
            print(f"Text length: {len(result['text'])} chars")
            print(f"\nFirst 500 chars:\n{result['text'][:500]}")
        else:
            print("No transcript found")

    elif args.source == "whisper" and args.file:
        result = transcribe_with_whisper(args.file, model=args.whisper_model)
        if result:
            print(f"Language: {result['language']}")
            print(f"Text length: {len(result['text'])} chars")
            print(f"\nFirst 500 chars:\n{result['text'][:500]}")
        else:
            print("Transcription failed")

    else:
        print("Usage examples:")
        print("  python extract_transcripts.py --source ia --id CSPAN_20240403_120000_...")
        print("  python extract_transcripts.py --source youtube --id dQw4w9WgXcQ")
        print("  python extract_transcripts.py --source whisper --file audio.mp3")
