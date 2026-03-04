import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = path.resolve("assets/tiles");
const OUTPUT_DIR = path.resolve("public/assets/generated");
const OUTPUT_IMAGE = path.join(OUTPUT_DIR, "tiles-atlas.png");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "tiles-atlas.json");

const FRAME_SIZE = 64;
const COLUMNS = 3;

function tileTypeFromFilename(fileName) {
  const match = /^tile_(.+)\.png$/i.exec(fileName);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase();
}

async function main() {
  const entries = await fs.readdir(SOURCE_DIR);
  const files = entries
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No PNG files found in ${SOURCE_DIR}`);
  }

  const frames = [];
  for (const fileName of files) {
    const tileType = tileTypeFromFilename(fileName);
    if (!tileType) {
      continue;
    }

    const sourcePath = path.join(SOURCE_DIR, fileName);
    frames.push({ fileName, tileType, sourcePath });
  }

  if (frames.length === 0) {
    throw new Error(`No files matched tile_*.png in ${SOURCE_DIR}`);
  }

  const rows = Math.ceil(frames.length / COLUMNS);
  const atlasWidth = COLUMNS * FRAME_SIZE;
  const atlasHeight = rows * FRAME_SIZE;

  const composites = [];
  const atlasFrames = {};

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const x = (i % COLUMNS) * FRAME_SIZE;
    const y = Math.floor(i / COLUMNS) * FRAME_SIZE;

    const input = await sharp(frame.sourcePath).png().toBuffer();

    composites.push({
      input,
      left: x,
      top: y,
    });

    atlasFrames[frame.tileType] = {
      frame: { x, y, w: FRAME_SIZE, h: FRAME_SIZE },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: FRAME_SIZE, h: FRAME_SIZE },
      sourceSize: { w: FRAME_SIZE, h: FRAME_SIZE },
    };
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(OUTPUT_IMAGE);

  const atlasJson = {
    frames: atlasFrames,
    meta: {
      app: "diablo-match/tools/build-tiles-atlas",
      version: "1",
      image: path.basename(OUTPUT_IMAGE),
      format: "RGBA8888",
      size: { w: atlasWidth, h: atlasHeight },
      scale: "1",
    },
  };

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(atlasJson, null, 2));
  console.log(`Built tile atlas: ${OUTPUT_IMAGE}`);
  console.log(`Built atlas metadata: ${OUTPUT_JSON}`);
  console.log(`Frames: ${Object.keys(atlasFrames).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
