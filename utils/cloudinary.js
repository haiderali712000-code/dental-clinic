const cloudinary = require('cloudinary').v2;

// Configure lazily so values from .env are available even if this module is
// required before another part of the app finishes loading environment config.
function ensureConfigured() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  const cloudinaryUrl = (process.env.CLOUDINARY_URL || '').trim();

  // Cloudinary commonly provides either the three separate variables or one
  // CLOUDINARY_URL. Support both without requiring the user to change .env.
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
    return true;
  }

  if (cloudinaryUrl) {
    cloudinary.config(cloudinaryUrl);
    return true;
  }

  throw new Error(
    'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env (or use CLOUDINARY_URL).'
  );
}

function uploadBuffer(buffer, folder) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function destroy(publicId) {
  if (!publicId) return;
  try {
    ensureConfigured();
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true
    });
  } catch (_err) {
    // Deleting the database record should still succeed if Cloudinary is
    // temporarily unavailable or not configured.
    return null;
  }
}

module.exports = { cloudinary, uploadBuffer, destroy, ensureConfigured };
