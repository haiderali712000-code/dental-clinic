const sharp = require('sharp');

// Every photo upload across the site (doctors, team, CEO, gallery, clinic
// gallery, and anything added later) is expected to end up under this size,
// since it's what Cloudinary/the admin forms were built around.
const TARGET_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Compresses an image buffer down to (at most, best-effort) targetBytes.
 * Leaves images that are already small enough untouched. Anything that does
 * need shrinking is normalized to JPEG, since that's what lets us reliably
 * hit a byte target by adjusting quality (and, if that's not enough,
 * dimensions) — this app only stores photographic content (people, clinic,
 * treatment photos), not logos/transparent graphics, so that's a safe trade.
 */
async function compressToLimit(buffer, targetBytes = TARGET_MAX_BYTES) {
  if (!buffer || buffer.length <= targetBytes) return buffer;

  let quality = 82;
  let width = null; // null = keep original dimensions on the first pass
  let output = buffer;

  for (let attempt = 0; attempt < 8; attempt++) {
    let pipeline = sharp(buffer, { failOn: 'none' }).rotate(); // respect EXIF orientation

    if (width) {
      pipeline = pipeline.resize({ width, withoutEnlargement: true });
    }

    output = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

    if (output.length <= targetBytes) return output;

    // First bring quality down; once that stops helping, start shrinking
    // the actual dimensions too (very large source images sometimes can't
    // hit the target on quality reduction alone).
    if (quality > 35) {
      quality -= 12;
    } else {
      quality = 50;
      width = width ? Math.round(width * 0.8) : 1800;
    }
  }

  // Best effort after repeated attempts — still return the smallest version
  // we managed to produce rather than failing the upload outright.
  return output;
}

module.exports = { compressToLimit, TARGET_MAX_BYTES };
