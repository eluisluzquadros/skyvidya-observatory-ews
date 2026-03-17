"""
Download IBGE municipality GeoParquet file.
Run once to set up the analytics pipeline data dependency.

Usage:
    python scripts/download_ibge.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for config import
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import IBGE_DATA_DIR, IBGE_GEOPARQUET_FILENAME, IBGE_GEOPARQUET_URL


def download_ibge_geoparquet():
    """Download IBGE municipality boundaries GeoParquet."""
    output_path = IBGE_DATA_DIR / IBGE_GEOPARQUET_FILENAME

    if output_path.exists():
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"IBGE GeoParquet already exists: {output_path} ({size_mb:.1f} MB)")
        response = input("Re-download? (y/N): ").strip().lower()
        if response != "y":
            print("Skipping download.")
            return

    IBGE_DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading IBGE GeoParquet from: {IBGE_GEOPARQUET_URL}")
    print(f"Saving to: {output_path}")

    try:
        import httpx

        with httpx.stream("GET", IBGE_GEOPARQUET_URL, follow_redirects=True, timeout=120) as response:
            response.raise_for_status()
            total = int(response.headers.get("content-length", 0))
            downloaded = 0

            with open(output_path, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded / total * 100
                        print(f"\rProgress: {pct:.1f}% ({downloaded / 1024 / 1024:.1f} MB)", end="")

        print()  # newline after progress
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"Download complete: {output_path} ({size_mb:.1f} MB)")

    except ImportError:
        # Fallback to urllib if httpx is not available
        import urllib.request

        print("Using urllib (install httpx for progress bar)")
        urllib.request.urlretrieve(IBGE_GEOPARQUET_URL, str(output_path))
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"Download complete: {output_path} ({size_mb:.1f} MB)")

    except Exception as e:
        print(f"Error downloading IBGE data: {e}")
        if output_path.exists():
            output_path.unlink()
        sys.exit(1)


if __name__ == "__main__":
    download_ibge_geoparquet()
