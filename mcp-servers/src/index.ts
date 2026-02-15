import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseKml } from "./kml-parser.js";
import { STATUS_LABELS } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kmlPath = join(__dirname, "..", "doc.kml");
const { places, whcSites } = parseKml(kmlPath);

const server = new McpServer({
  name: "mark-o-travel",
  version: "1.0.0",
});

server.tool("get_visited_places", "Get all places with status 'Visited'", {}, () => {
  const visited = places.filter((p) => p.statusId === 4);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(visited, null, 2),
      },
    ],
  };
});

server.tool(
  "get_places_by_status",
  "Get places filtered by status: 0=Not visited, 1=Lived, 2=Planned, 3=Wishlist, 4=Visited",
  { status: z.number().int().min(0).max(4).describe("Status ID (0-4)") },
  ({ status }) => {
    const filtered = places.filter((p) => p.statusId === status);
    const label = STATUS_LABELS[status] ?? `Status ${status}`;
    return {
      content: [
        {
          type: "text",
          text: `${label} (${filtered.length} places):\n${JSON.stringify(filtered, null, 2)}`,
        },
      ],
    };
  }
);

server.tool(
  "search_places",
  "Search places and UNESCO sites by name (case-insensitive substring match)",
  { query: z.string().min(1).describe("Search query") },
  ({ query }) => {
    const q = query.toLowerCase();
    const matchedPlaces = places.filter((p) => p.name.toLowerCase().includes(q));
    const matchedSites = whcSites.filter((s) => s.name.toLowerCase().includes(q));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ places: matchedPlaces, whcSites: matchedSites }, null, 2),
        },
      ],
    };
  }
);

server.tool("get_travel_stats", "Get travel statistics summary", {}, () => {
  const statusCounts: Record<string, number> = {};
  for (const p of places) {
    const label = STATUS_LABELS[p.statusId] ?? `Status ${p.statusId}`;
    statusCounts[label] = (statusCounts[label] ?? 0) + 1;
  }

  const visitedWhc = whcSites.filter((s) => s.visited).length;

  const stats = {
    totalPlaces: places.length,
    byStatus: statusCounts,
    unesco: {
      total: whcSites.length,
      visited: visitedWhc,
      notVisited: whcSites.length - visitedWhc,
    },
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
