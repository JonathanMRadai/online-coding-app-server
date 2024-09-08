const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://radai2510:eHO2y1omCbGkypwM@online-coding-app.ckjjo.mongodb.net/?retryWrites=true&w=majority&appName=online-coding-app');
    console.log('MongoDB connected...');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
