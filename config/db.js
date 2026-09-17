const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured. Add your MongoDB Atlas connection string in Vercel Environment Variables.');
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    }).catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }

  await connectionPromise;
  console.log('MongoDB connected');
  return mongoose.connection;
}

module.exports = connectDB;
