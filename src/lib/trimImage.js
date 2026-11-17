// Trims the empty (fully transparent) margin off a logo before it is uploaded. A logo exported on a square canvas with the artwork small in the middle
// is shown at the header's logo height, so the artwork itself ends up tiny: trimming lets the header size the artwork, not the empty space around it.
// Returns the original file when there is nothing worth trimming (no transparency, an SVG, under a tenth to gain) or the image can't be read.
const PAD = 0.06; // breathing room kept around the artwork, as a share of its longer side
const MIN_GAIN = 0.1;

export async function trimTransparentEdges(file) {
  try {
    if (!file || !/^image\/(png|webp|gif)$/.test(file.type)) return file;
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return file; // nothing visible at all
    const pad = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * PAD);
    const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
    const x1 = Math.min(width, maxX + 1 + pad), y1 = Math.min(height, maxY + 1 + pad);
    const w = x1 - x0, h = y1 - y0;
    if (w * h > width * height * (1 - MIN_GAIN)) return file;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d").drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
    const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".png", { type: "image/png" });
  } catch {
    return file;
  }
}
