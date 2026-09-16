const Counter = require('../models/Counter');

/**
 * Generates a unique daily token like DEN-20260916-001.
 * Uses an atomic findOneAndUpdate on a per-day counter document so
 * concurrent bookings on the same day never collide.
 */
async function generateToken() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dayKey = `${y}${m}${d}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: dayKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(3, '0');
  return `DEN-${dayKey}-${seqStr}`;
}

module.exports = generateToken;
