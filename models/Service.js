const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, required: true, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    isAdminAdded: { type: Boolean, default: false },
    videoUrl: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
