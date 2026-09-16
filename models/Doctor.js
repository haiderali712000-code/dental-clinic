const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    photoUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
