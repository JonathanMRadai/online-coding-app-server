const mongoose = require('mongoose');

const CodeBlockSchema = new mongoose.Schema({
  codeBlockName: { type: String, required: true },
  initialCode: { type: String, required: true },
  solution: { type: String, required: true },
  // Fields for ratings
  totalRating: { type: Number, default: 0 }, // Sum of all ratings
  numRatings: { type: Number, default: 0 }   // Number of ratings
});

module.exports = mongoose.model('CodeBlock', CodeBlockSchema);
