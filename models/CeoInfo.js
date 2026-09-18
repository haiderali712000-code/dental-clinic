const mongoose = require('mongoose');

// Singleton-style document: only one CEO record is ever expected to exist.
// The admin routes always find-or-create a single document rather than a list.
const ceoInfoSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: 'Chief Executive Officer' },
    photoUrl: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CeoInfo', ceoInfoSchema);
