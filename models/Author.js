const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    biography: {
      type: String,
      trim: true,
      maxlength: 1500,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Author', authorSchema);
