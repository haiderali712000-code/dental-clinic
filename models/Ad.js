const mongoose = require('mongoose');

const adSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Ad || mongoose.model('Ad', adSchema);
