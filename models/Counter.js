const mongoose = require('mongoose');

// One document per calendar day (e.g. _id = "20260916"), seq increments per booking that day.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);
