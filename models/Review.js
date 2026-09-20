const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
    reviewText: { type: String, required: true, trim: true },
    // Reviews added by the admin are trusted and published immediately.
    // Reviews submitted by visitors on the public site start unapproved
    // and only show on the homepage once an admin approves them.
    approved: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
