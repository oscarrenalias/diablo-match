import fs from "node:fs/promises";
import path from "node:path";
import { packAsync } from "free-tex-packer-core";
import sharp from "sharp";

const PORTRAITS_SOURCE_ROOT = path.resolve("assets/sources/portraits");
const UI_SOURCE_ROOT = path.resolve("assets/sources/ui");
const OUTPUT_DIR = path.resolve("public/assets/generated/atlas");
const TEXTURE_NAME = "ui-portraits-atlas";
const PORTRAIT_MAX_SIZE = 384;
const UI_MAX_SIZE = 384;
const UI_ALPHA_CLEANUP_THRESHOLD = 20;

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

function atlasPathForFile(fullPath, root, prefix) {
  const rel = path.relative(root, fullPath);
  const noExt = rel.replace(/\.png$/i, "");
  return `${prefix}/${noExt}`.replaceAll(path.sep, "/");
}

async function walkOptionalFiles(dir) {
  try {
    return await walkFiles(dir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function main() {
  const portraitFiles = (await walkOptionalFiles(PORTRAITS_SOURCE_ROOT)).sort((a, b) => a.localeCompare(b));
  const uiFiles = (await walkOptionalFiles(UI_SOURCE_ROOT)).sort((a, b) => a.localeCompare(b));
  if (portraitFiles.length === 0 && uiFiles.length === 0) {
    throw new Error(`No portrait/UI PNG files found under ${PORTRAITS_SOURCE_ROOT} or ${UI_SOURCE_ROOT}`);
  }

  const portraitImages = await Promise.all(
    portraitFiles.map(async (filePath) => {
      const normalized = await sharp(filePath)
        .resize(PORTRAIT_MAX_SIZE, PORTRAIT_MAX_SIZE, {
          fit: "inside",
          kernel: sharp.kernel.nearest,
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();

      return {
        path: `${atlasPathForFile(filePath, PORTRAITS_SOURCE_ROOT, "portraits")}.png`,
        contents: normalized,
      };
    }),
  );

  const uiImages = await Promise.all(
    uiFiles.map(async (filePath) => {
      const resized = await sharp(filePath)
        .resize(UI_MAX_SIZE, UI_MAX_SIZE, {
          fit: "inside",
          kernel: sharp.kernel.nearest,
          withoutEnlargement: true,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Remove faint alpha haze around the frame perimeter.
      for (let i = 3; i < resized.data.length; i += 4) {
        if (resized.data[i] < UI_ALPHA_CLEANUP_THRESHOLD) {
          resized.data[i] = 0;
        }
      }

      const normalized = await sharp(resized.data, {
        raw: {
          width: resized.info.width,
          height: resized.info.height,
          channels: resized.info.channels,
        },
      })
        .png()
        .toBuffer();

      return {
        path: `${atlasPathForFile(filePath, UI_SOURCE_ROOT, "ui")}.png`,
        contents: normalized,
      };
    }),
  );

  const images = [...portraitImages, ...uiImages];

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

  // Preserve alpha exactly for UI overlays/frames after packing.
  // Some sources can lose transparency in the packer pipeline; re-composite
  // normalized UI buffers into their packed slots to keep transparent cutouts.
  const atlasJsonPath = path.join(OUTPUT_DIR, `${TEXTURE_NAME}.json`);
  const atlasImagePath = path.join(OUTPUT_DIR, `${TEXTURE_NAME}.png`);
  const atlasJson = JSON.parse(await fs.readFile(atlasJsonPath, "utf8"));
  const uiComposites = [];
  for (const image of uiImages) {
    const key = image.path.replace(/\.png$/i, "");
    const frame = atlasJson.frames?.[key]?.frame;
    if (!frame) {
      continue;
    }

    // Clear destination region first so fully transparent source pixels remain transparent.
    const clearBuffer = await sharp({
      create: {
        width: frame.w,
        height: frame.h,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    uiComposites.push({
      input: clearBuffer,
      left: frame.x,
      top: frame.y,
      blend: "dest-out",
    });

    uiComposites.push({
      input: image.contents,
      left: frame.x,
      top: frame.y,
      blend: "over",
    });
  }

  if (uiComposites.length > 0) {
    const recompositedAtlas = await sharp(atlasImagePath).composite(uiComposites).png().toBuffer();
    const atlasRaw = await sharp(recompositedAtlas).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const atlasWidth = atlasRaw.info.width;

    for (const frameKey of Object.keys(atlasJson.frames ?? {})) {
      if (!frameKey.startsWith("ui/")) {
        continue;
      }
      const frame = atlasJson.frames[frameKey]?.frame;
      if (!frame) {
        continue;
      }

      for (let y = frame.y; y < frame.y + frame.h; y += 1) {
        for (let x = frame.x; x < frame.x + frame.w; x += 1) {
          const alphaIndex = (y * atlasWidth + x) * 4 + 3;
          if (atlasRaw.data[alphaIndex] < UI_ALPHA_CLEANUP_THRESHOLD) {
            atlasRaw.data[alphaIndex] = 0;
          }
        }
      }
    }

    const cleanedAtlas = await sharp(atlasRaw.data, {
      raw: {
        width: atlasRaw.info.width,
        height: atlasRaw.info.height,
        channels: atlasRaw.info.channels,
      },
    })
      .png()
      .toBuffer();

    await fs.writeFile(atlasImagePath, cleanedAtlas);
  }

  console.log(`Built UI atlas into ${OUTPUT_DIR}`);
  console.log(`Frames packed: ${images.length} (${portraitImages.length} portraits, ${uiImages.length} ui)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
