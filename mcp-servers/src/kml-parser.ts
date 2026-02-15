import { readFileSync } from "fs";
import { XMLParser } from "fast-xml-parser";
import { Place, WorldHeritageSite } from "./types.js";

interface KmlData {
  places: Place[];
  whcSites: WorldHeritageSite[];
}

export function parseKml(filePath: string): KmlData {
  const xml = readFileSync(filePath, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (tagName) => tagName === "Placemark" || tagName === "Data" || tagName === "Folder",
  });
  const doc = parser.parse(xml);

  const folders: any[] = doc.kml.Document.Folder;

  const places: Place[] = [];
  const whcSites: WorldHeritageSite[] = [];

  for (const folder of folders) {
    const folderName: string = folder.name;
    const placemarks: any[] = folder.Placemark ?? [];

    if (folderName === "GFSubject") {
      for (const pm of placemarks) {
        const extData = parseExtendedData(pm.ExtendedData?.Data);
        places.push({
          name: String(pm.name),
          description: String(pm.description ?? ""),
          code: extData["code"],
          statusId: parseInt(extData["status_id"] ?? "0", 10),
          color: extData["color"],
        });
      }
    } else if (folderName === "GFWhc") {
      for (const pm of placemarks) {
        const extData = parseExtendedData(pm.ExtendedData?.Data);
        whcSites.push({
          id: String(pm.name),
          name: String(pm.description ?? ""),
          visited: extData["visited"] === "1",
        });
      }
    }
  }

  return { places, whcSites };
}

function parseExtendedData(dataEntries: any[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!dataEntries) return result;
  for (const entry of dataEntries) {
    const key = entry["@_name"];
    if (key) {
      result[key] = String(entry.value ?? "");
    }
  }
  return result;
}
