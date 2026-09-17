const Counter = require('../models/Counter');

/**
 * Generates a unique sequential token like HIKS-01, HIKS-02, HIKS-03, ...
 * Uses an atomic findOneAndUpdate on a single fixed counter document
 * (not per-day) so the sequence never resets, and concurrent bookings
 * never collide.
 */
async function generateToken() {
  const COUNTER_KEY = 'appointment-token';

  const counter = await Counter.findOneAndUpdate(
    { _id: COUNTER_KEY },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(2, '0');
  return `HIKS-${seqStr}`;
}

module.exports = generateToken;
