# Photo Finder MCP Server

A local MCP server that scans a folder of photos to find ones containing a specific person, using face recognition. Built for finding your child's photos in large event/competition galleries — no cloud API needed, everything runs on your machine.

## How It Works

1. You provide a folder of **reference photos** (clear photos of the person you're looking for)
2. The server builds a face "fingerprint" from those references
3. It scans every photo in the competition folder and compares faces against the fingerprint
4. Matches are returned with confidence scores, and optionally copied to an output folder

## Installation

### 1. Prerequisites

**On Mac**, install cmake and dlib dependencies first (required by `face_recognition`):

```bash
brew install cmake
brew install boost
```

**On Windows/Linux**, see the [dlib install guide](https://github.com/davisking/dlib).

### 2. Set up a Python virtual environment

```bash
cd mcp-servers/photo-finder
python3 -m venv venv
source venv/bin/activate       # Mac/Linux
# .\venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

> **Note**: The first install takes a few minutes as it compiles dlib from source.

### 3. Add to Claude Desktop config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "photo-finder": {
      "command": "/absolute/path/to/mcp-servers/photo-finder/venv/bin/python",
      "args": ["/absolute/path/to/mcp-servers/photo-finder/server.py"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path to your cloned repo.

Restart Claude Desktop after saving.

## Usage

### Step 1 — Validate your reference photos

Tell Claude:
> "Validate my reference photos at `/Users/you/Photos/daughter_refs`"

This confirms face detection works on your reference images before doing the full scan.

### Step 2 — Scan the competition folder

Tell Claude:
> "Find my daughter's photos in `/Users/you/Photos/Ballet2025`, using references from `/Users/you/Photos/daughter_refs`, and copy matches to `/Users/you/Photos/Ballet_Results`"

Claude will call the MCP and return a list of matched photos with confidence scores.

## Tools

### `validate_references`
| Parameter | Type | Description |
|---|---|---|
| `reference_dir` | string | Path to folder with reference photos |

### `find_person_in_photos`
| Parameter | Type | Required | Description |
|---|---|---|---|
| `reference_dir` | string | ✅ | Folder with reference photos of the person |
| `photo_dir` | string | ✅ | Folder with photos to scan |
| `output_dir` | string | ❌ | Folder to copy matched photos into |
| `tolerance` | number | ❌ | Match strictness (default: `0.55`) |

## Tuning Tolerance

| Tolerance | Effect |
|---|---|
| `0.45` | Very strict — fewer false positives, may miss some |
| `0.55` | Default — good balance |
| `0.60` | More lenient — better for stage makeup, unusual lighting |
| `0.65` | Very lenient — use only if still missing obvious matches |

## Tips for Best Results

- Use **3–5 reference photos** showing different angles, lighting conditions, and expressions
- Include a reference photo with **similar hair/makeup** to the event if possible
- Reference photos should be **clear, well-lit, unobstructed** face shots
- The scanner processes sub-folders recursively, so nested folder structures work fine

## Performance

On a modern Mac with ~300 photos, expect roughly 1–3 minutes for a full scan using the default HOG model. For faster scanning on large galleries (1000+ photos), the CNN model is more accurate but slower — edit `model="hog"` to `model="cnn"` in `server.py` if you have a GPU.
