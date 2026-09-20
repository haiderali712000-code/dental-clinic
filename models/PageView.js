const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    referrer: { type: String },
    visitorId: { type: String, required: true }
  },
  { timestamps: true }
);

pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ path: 1, createdAt: -1 });
pageViewSchema.index({ visitorId: 1, createdAt: -1 });

module.exports = mongoose.models.PageView || mongoose.model('PageView', pageViewSchema);
