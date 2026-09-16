const multer = require('multer');

const fileFilter = (_req, file, cb) => {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, WEBP or GIF image files are allowed.'));
};

// Keep uploads in memory so they can be sent directly to Cloudinary.
// No clinic/doctor photos are written to the server disk.
module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
