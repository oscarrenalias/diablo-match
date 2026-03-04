import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SOURCE_DIR = path.resolve("assets/sources/tiles");
const OUTPUT_DIR = path.resolve("assets/tiles");
const TARGET_SIZE = 64;
const MID_SIZE = 256;
const FINAL_COLORS = 16;

function tileTypeFromFilename(fileName) {
  const match = /^tile_(.+)\.png$/i.exec(fileName);
  return match ? match[1].toLowerCase() : null;
}

async function identifySquareSize(filePath) {
  const { stdout } = await execFileAsync("magick", [
    "identify",
    "-format",
    "%w %h",
    filePath,
  ]);

  const [wStr, hStr] = stdout.trim().split(/\s+/);
  const width = Number.parseInt(wStr, 10);
  const height = Number.parseInt(hStr, 10);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Unable to read image dimensions: ${filePath}`);
  }

  return Math.max(width, height);
}

async function processTile(sourcePath, outputPath) {
  const squareSize = await identifySquareSize(sourcePath);

  const args = [
    sourcePath,
    "-alpha",
    "set",
    "-background",
    "none",
    "-trim",
    "+repage",
    "-gravity",
    "center",
    "-extent",
    `${squareSize}x${squareSize}`,
    "-filter",
    "point",
    "-resize",
    `${MID_SIZE}x${MID_SIZE}!`,
    "-filter",
    "point",
    "-resize",
    `${TARGET_SIZE}x${TARGET_SIZE}!`,
    "+dither",
    "-colors",
    String(FINAL_COLORS),
    "-strip",
    "-define",
    "png:color-type=6",
    "-define",
    "png:compression-level=9",
    "-define",
    "png:compression-strategy=1",
    `PNG32:${outputPath}`,
  ];

  await execFileAsync("magick", args);
}

async function main() {
  const entries = await fs.readdir(SOURCE_DIR);
  const files = entries.filter((name) => name.toLowerCase().endsWith(".png")).sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No PNG files found in ${SOURCE_DIR}`);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const outputs = [];

  for (const fileName of files) {
    const tileType = tileTypeFromFilename(fileName);
    if (!tileType) {
      continue;
    }

    const sourcePath = path.join(SOURCE_DIR, fileName);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    await processTile(sourcePath, outputPath);
    outputs.push({ tileType, outputPath });
  }

  if (outputs.length === 0) {
    throw new Error(`No tile_*.png files found in ${SOURCE_DIR}`);
  }

  console.log(`Processed ${outputs.length} tiles into ${OUTPUT_DIR}`);
  console.log(`Tiles: ${outputs.map((entry) => entry.tileType).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
