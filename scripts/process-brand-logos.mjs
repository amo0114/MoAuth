import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "image");
const outDir = path.join(root, "apps/account/public/brand");

function floodFillBackground(data, width, height, channels, isBackground) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isBackground(r, g, b)) continue;

    data[i + 3] = 0;

    if (x > 0) queue.push([x - 1, y]);
    if (x < width - 1) queue.push([x + 1, y]);
    if (y > 0) queue.push([x, y - 1]);
    if (y < height - 1) queue.push([x, y + 1]);
  }
}

async function makeTransparentMark(input, output, isBackground) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  floodFillBackground(data, width, height, channels, isBackground);

  await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 1 })
    .extend({
      top: 12,
      bottom: 12,
      left: 12,
      right: 12,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(512, 512, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(output);
}

const nearWhite = (r, g, b) =>
  r >= 235 && g >= 235 && b >= 235 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;

const nearCream = (r, g, b) =>
  r >= 235 &&
  g >= 228 &&
  b >= 215 &&
  Math.abs(r - g) <= 12 &&
  Math.abs(g - b) <= 18;

const nearBlack = (r, g, b) => {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma <= 28 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
};

await makeTransparentMark(
  path.join(srcDir, "tubiao_light.png"),
  path.join(outDir, "aura-logo-mark.png"),
  nearCream
);

await makeTransparentMark(
  path.join(srcDir, "tubiao_light.png"),
  path.join(outDir, "aura-logo-mark-light.png"),
  nearCream
);

// tubiao_dark.png ships with a 1:1 black plate; reuse the light mark for dark UI.
await makeTransparentMark(
  path.join(srcDir, "tubiao_light.png"),
  path.join(outDir, "aura-logo-mark-dark.png"),
  nearCream
);

const faviconSource = path.join(outDir, "aura-logo-mark-light.png");
for (const [size, name] of [
  [32, "favicon-32.png"],
  [192, "favicon-192.png"],
  [180, "apple-touch-icon.png"],
]) {
  await sharp(faviconSource)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(outDir, name));
}

console.log("Processed transparent Aura brand marks in", outDir);