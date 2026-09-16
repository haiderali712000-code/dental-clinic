const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    patientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    service: { type: String, required: true, trim: true },
    servicePrice: { type: Number, required: true, min: 0, default: 0 },
    preferredDate: { type: Date, required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
