const multer = require('multer');

const fileFilter = (_req, file, cb) => {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, WEBP or GIF image files are allowed.'));
};

// Accept large raw uploads here (e.g. straight-from-phone photos can be
// 10-15MB) — utils/cloudinary.js compresses every image down to 5MB or
// under before it's actually sent to Cloudinary, so this is just the
// ceiling on what multer will accept into memory at all.
module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
});
