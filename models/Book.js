const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    isbn: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 13,
      match: [/^\d{13}$/, 'ISBN must contain exactly 13 digits.'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    publicationYear: {
      type: Number,
      required: true,
      min: 1450,
      max: new Date().getFullYear() + 1,
      validate: Number.isInteger,
    },
    totalCopies: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
      validate: Number.isInteger,
    },
    availableCopies: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },

    // Store IDs so a book can have several authors and categories.
    authors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Author' }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  },
  { timestamps: true },
);

module.exports = mongoose.model('Book', bookSchema);
