import fs from "node:fs/promises";
import path from "node:path";
import { packAsync } from "free-tex-packer-core";
import sharp from "sharp";

const SOURCE_ROOT = path.resolve("assets/sources/portraits");
const OUTPUT_DIR = path.resolve("public/assets/generated/atlas");
const TEXTURE_NAME = "ui-portraits-atlas";
const PORTRAIT_MAX_SIZE = 384;

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      out.push(full);
    }
  }

  return out;
}

function atlasPathForFile(fullPath) {
  const rel = path.relative(SOURCE_ROOT, fullPath);
  const noExt = rel.replace(/\.png$/i, "");
  return `portraits/${noExt}`.replaceAll(path.sep, "/");
}

async function main() {
  const files = (await walkFiles(SOURCE_ROOT)).sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new Error(`No portrait PNG files found under ${SOURCE_ROOT}`);
  }

  const images = await Promise.all(
    files.map(async (filePath) => {
      const normalized = await sharp(filePath)
        .resize(PORTRAIT_MAX_SIZE, PORTRAIT_MAX_SIZE, {
          fit: "inside",
          kernel: sharp.kernel.nearest,
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      return {
        path: `${atlasPathForFile(filePath)}.png`,
        contents: normalized,
      };
    }),
  );

  const packed = await packAsync(images, {
    textureName: TEXTURE_NAME,
    width: 4096,
    height: 4096,
    fixedSize: false,
    powerOfTwo: true,
    padding: 2,
    extrude: 1,
    allowRotation: false,
    detectIdentical: true,
    allowTrim: false,
    removeFileExtension: true,
    prependFolderName: true,
    textureFormat: "png",
    exporter: "PhaserHash",
    scaleMethod: "NEAREST_NEIGHBOR",
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await fs.readdir(OUTPUT_DIR);
  await Promise.all(
    existing
      .filter((name) => name.startsWith(TEXTURE_NAME))
      .map((name) => fs.rm(path.join(OUTPUT_DIR, name), { force: true })),
  );

  if (packed.length !== 2) {
    throw new Error(`Expected single atlas PNG+JSON output, got ${packed.length} files`);
  }

  for (const item of packed) {
    const outputName = item.name
      .replace(`${TEXTURE_NAME}-0.png`, `${TEXTURE_NAME}.png`)
      .replace(`${TEXTURE_NAME}-0.json`, `${TEXTURE_NAME}.json`);
    await fs.writeFile(path.join(OUTPUT_DIR, outputName), item.buffer);
  }

  console.log(`Built UI portrait atlas into ${OUTPUT_DIR}`);
  console.log(`Frames packed: ${images.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
