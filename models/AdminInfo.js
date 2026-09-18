const mongoose = require('mongoose');

// Singleton-style document: only one Admin record is ever expected to exist.
// The admin routes always find-or-create a single document rather than a list.
const adminInfoSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: 'Administrator' },
    photoUrl: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminInfo', adminInfoSchema);
