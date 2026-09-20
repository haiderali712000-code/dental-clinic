const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
    reviewText: { type: String, required: true, trim: true },
    approved: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
