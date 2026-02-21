#!/usr/bin/env python3
"""
Photo Finder MCP Server
Finds photos of a specific person using face recognition.
"""

import os
import shutil
import json
from pathlib import Path
from typing import Any

import face_recognition
import numpy as np
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

app = Server("photo-finder")


def load_reference_encodings(reference_dir: str) -> list:
    """Load face encodings from all reference photos in a directory."""
    ref_path = Path(reference_dir)
    if not ref_path.exists():
        raise ValueError(f"Reference directory does not exist: {reference_dir}")

    encodings = []
    supported = {".jpg", ".jpeg", ".png", ".heic", ".webp"}
    ref_files = [f for f in ref_path.iterdir() if f.suffix.lower() in supported]

    if not ref_files:
        raise ValueError(f"No supported image files found in: {reference_dir}")

    for ref_file in ref_files:
        try:
            image = face_recognition.load_image_file(str(ref_file))
            found = face_recognition.face_encodings(image)
            if found:
                encodings.append(found[0])
            else:
                print(f"[warn] No face detected in reference: {ref_file.name}")
        except Exception as e:
            print(f"[warn] Could not process reference {ref_file.name}: {e}")

    if not encodings:
        raise ValueError("No valid face encodings found in any reference photo.")

    return encodings


def scan_directory(
    photo_dir: str,
    reference_encodings: list,
    tolerance: float = 0.55,
    output_dir: str | None = None,
) -> list[dict]:
    """Scan a directory of photos and return matches."""
    photo_path = Path(photo_dir)
    if not photo_path.exists():
        raise ValueError(f"Photo directory does not exist: {photo_dir}")

    supported = {".jpg", ".jpeg", ".png", ".heic", ".webp"}
    all_photos = [
        f for f in photo_path.rglob("*") if f.suffix.lower() in supported
    ]

    if not all_photos:
        raise ValueError(f"No supported image files found in: {photo_dir}")

    if output_dir:
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

    matches = []
    ref_encodings_np = np.array(reference_encodings)

    for photo_file in all_photos:
        try:
            image = face_recognition.load_image_file(str(photo_file))
            face_locations = face_recognition.face_locations(image, model="hog")
            if not face_locations:
                continue

            face_encodings = face_recognition.face_encodings(image, face_locations)

            for encoding in face_encodings:
                distances = face_recognition.face_distance(ref_encodings_np, encoding)
                min_distance = float(np.min(distances))
                if min_distance <= tolerance:
                    confidence = round((1 - min_distance) * 100, 1)
                    match = {
                        "file": str(photo_file),
                        "filename": photo_file.name,
                        "confidence": confidence,
                        "distance": round(min_distance, 4),
                    }
                    matches.append(match)

                    if output_dir:
                        dest = Path(output_dir) / photo_file.name
                        # Avoid overwriting if filenames collide
                        if dest.exists():
                            dest = Path(output_dir) / f"{photo_file.stem}_{photo_file.parent.name}{photo_file.suffix}"
                        shutil.copy2(str(photo_file), str(dest))
                    break  # One match per photo is enough

        except Exception as e:
            print(f"[warn] Could not process {photo_file.name}: {e}")

    matches.sort(key=lambda x: x["confidence"], reverse=True)
    return matches


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="find_person_in_photos",
            description=(
                "Scans a folder of photos to find ones containing a specific person, "
                "using face recognition against reference photos. "
                "Optionally copies matches to an output folder."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "reference_dir": {
                        "type": "string",
                        "description": "Path to folder containing 1–10 clear reference photos of the person to find.",
                    },
                    "photo_dir": {
                        "type": "string",
                        "description": "Path to folder containing competition/event photos to scan.",
                    },
                    "output_dir": {
                        "type": "string",
                        "description": "Optional. Path to folder where matched photos will be copied.",
                    },
                    "tolerance": {
                        "type": "number",
                        "description": (
                            "Face match tolerance (0.0–1.0). Lower = stricter. "
                            "Default 0.55 works well. Try 0.5 for fewer false positives, "
                            "0.6 if missing too many matches (e.g. heavy stage makeup)."
                        ),
                        "default": 0.55,
                    },
                },
                "required": ["reference_dir", "photo_dir"],
            },
        ),
        types.Tool(
            name="validate_references",
            description="Check how many usable face encodings can be extracted from a reference photo folder. Run this first to confirm your reference photos are good.",
            inputSchema={
                "type": "object",
                "properties": {
                    "reference_dir": {
                        "type": "string",
                        "description": "Path to folder containing reference photos.",
                    }
                },
                "required": ["reference_dir"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    if name == "validate_references":
        ref_dir = arguments["reference_dir"]
        try:
            encodings = load_reference_encodings(ref_dir)
            ref_path = Path(ref_dir)
            supported = {".jpg", ".jpeg", ".png", ".heic", ".webp"}
            total_files = len([f for f in ref_path.iterdir() if f.suffix.lower() in supported])
            result = {
                "status": "ok",
                "total_reference_files": total_files,
                "usable_face_encodings": len(encodings),
                "message": f"Successfully loaded {len(encodings)} face encoding(s) from {total_files} photo(s). Ready to scan.",
            }
        except Exception as e:
            result = {"status": "error", "message": str(e)}
        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    elif name == "find_person_in_photos":
        ref_dir = arguments["reference_dir"]
        photo_dir = arguments["photo_dir"]
        output_dir = arguments.get("output_dir")
        tolerance = float(arguments.get("tolerance", 0.55))

        try:
            reference_encodings = load_reference_encodings(ref_dir)
            matches = scan_directory(photo_dir, reference_encodings, tolerance, output_dir)

            result = {
                "status": "ok",
                "total_matches": len(matches),
                "tolerance_used": tolerance,
                "output_dir": output_dir,
                "matches": matches,
            }

            if not matches:
                result["tip"] = (
                    "No matches found. Try increasing tolerance to 0.6 or 0.65, "
                    "or add more reference photos showing different angles and lighting."
                )

        except Exception as e:
            result = {"status": "error", "message": str(e)}

        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    return [types.TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
