const mongoose = require('mongoose');

// Stores running counters. For appointment tokens we use a single fixed
// document (_id = "appointment-token") so the HIKS-01, HIKS-02, ... sequence
// never resets. (If you reuse this model for anything per-day/per-period,
// just use a different _id convention for that.)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);
