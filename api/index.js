const app = require('../server');
const connectDB = require('../config/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (err) {
    console.error('Vercel startup error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production'
        ? 'Database connection/configuration failed.'
        : err.message
    });
  }
};
