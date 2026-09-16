const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Clinic', 'Services', 'Treatment Results'],
      default: 'Clinic'
    },
    treatment: {
      type: String,
      enum: ['Scaling', 'Whitening', 'RCT', 'Crowns', 'Implants', 'Cosmetic Dentistry', 'Other'],
      default: 'Other'
    },
    imageUrl: { type: String, required: true, trim: true },
    cloudinaryPublicId: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gallery', gallerySchema);
