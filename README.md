# Mark O'Travel MCP Server

An MCP (Model Context Protocol) server that exposes travel data from a KML file, plus a build-time map generator that produces an interactive choropleth visualization.

Live at [mingyu.org](https://mingyu.org)

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        doc.kml                              │
│              (Mark O'Travel export file)                    │
│         Places, UNESCO WHC sites, visit statuses            │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────────────┐
│   kml-parser.ts      │  │   kml-parser.ts                   │
│   (shared module)    │  │   (shared module)                 │
└──────────┬───────────┘  └──────────┬────────────────────────┘
           │                         │
           ▼                         ▼
┌──────────────────────┐  ┌───────────────────────────────────┐
│   index.ts           │  │   generate-map.ts                 │
│   MCP Server         │  │   Build Script                    │
│                      │  │                                   │
│ ┌──────────────────┐ │  │  1. Parse KML                     │
│ │ get_visited_     │ │  │  2. Filter to 195 UN countries    │
│ │ places           │ │  │  3. Normalize statuses            │
│ ├──────────────────┤ │  │  4. Group sub-regions by country  │
│ │ get_places_      │ │  │  5. Generate self-contained HTML  │
│ │ by_status        │ │  │                                   │
│ ├──────────────────┤ │  └──────────┬────────────────────────┘
│ │ search_places    │ │             │
│ ├──────────────────┤ │             ▼
│ │ get_travel_stats │ │  ┌───────────────────────────────────┐
│ └──────────────────┘ │  │   map.html (generated)            │
│                      │  │                                   │
│   stdio transport    │  │  ┌─────────────────────────────┐  │
│         ▲            │  │  │ Leaflet + CARTO tiles       │  │
└─────────┼────────────┘  │  │ GeoJSON country polygons    │  │
          │               │  │ Color-coded by status        │  │
          ▼               │  │ Click → sub-region panel     │  │
┌──────────────────────┐  │  │ Stats bar + legend           │  │
│   Claude / MCP       │  │  └─────────────────────────────┘  │
│   Client             │  └──────────┬────────────────────────┘
└──────────────────────┘             │
                                     ▼
                          ┌───────────────────────────────────┐
                          │   index.html (landing page)       │
                          │   mingyu.org                      │
                          │                                   │
                          │   Embeds map.html via <iframe>    │
                          │   GitHub Pages deployment         │
                          └───────────────────────────────────┘
```

## Data Flow

1. **Source**: `doc.kml` — exported from Mark O'Travel app. Contains places (countries and sub-regions) with visit statuses and UNESCO World Heritage sites.

2. **Parser**: `kml-parser.ts` — shared module that parses the KML/XML into typed `Place[]` and `WorldHeritageSite[]` arrays. Used by both the MCP server and the map generator.

3. **MCP Server** (`index.ts`) — exposes travel data as tools over stdio:
   - `get_visited_places` — all visited places
   - `get_places_by_status` — filter by status ID
   - `search_places` — substring search across places and UNESCO sites
   - `get_travel_stats` — summary statistics

4. **Map Generator** (`generate-map.ts`) — build-time script that:
   - Filters to 195 UN member states (2-letter ISO codes)
   - Normalizes corrupted status IDs (e.g., `916343000` → Transited)
   - Groups 2,600+ sub-regions under their parent countries
   - Outputs a self-contained `map.html` with all data inlined

5. **Visualization** (`map.html`) — interactive Leaflet map loaded from CDN (zero npm dependencies at runtime):
   - Country polygons colored by status: green (visited), red (lived), orange (transited), gray (not visited)
   - Click any country to see sub-region breakdown in a side panel
   - Stats bar and legend

6. **Landing Page** (`index.html`) — embeds the map via iframe on [mingyu.org](https://mingyu.org), deployed with GitHub Pages.

## Project Structure

```
mingyu.org/
├── index.html              # Landing page (GitHub Pages root)
└── mcp-servers/
    ├── doc.kml             # Travel data (Mark O'Travel export)
    ├── map.html            # Generated interactive map
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── types.ts        # StatusId enum, Place/WHC interfaces
        ├── kml-parser.ts   # KML → typed data parser
        ├── index.ts        # MCP server (stdio transport)
        └── generate-map.ts # Build script → map.html
```

## Usage

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Generate the interactive map
npm run generate-map    # → produces map.html

# Start MCP server (for Claude / MCP clients)
npm run start
```

## Status Legend

| Status    | Color  | ID |
|-----------|--------|----|
| Visited   | Green  | 4  |
| Lived in  | Red    | 1  |
| Transited | Orange | 5  |

## Tech Stack

- **Runtime**: Node.js, TypeScript (ES2022 modules)
- **MCP**: `@modelcontextprotocol/sdk` — stdio server transport
- **KML Parsing**: `fast-xml-parser`
- **Map**: Leaflet (CDN), CARTO tile server, GeoJSON country boundaries
- **Hosting**: GitHub Pages
