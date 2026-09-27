const mongoose = require('mongoose');
const models = require('../models');

module.exports = async function connect(uri) {
  if (!uri) {
    throw new Error('Set MONGODB_URI in .env, or run npm run demo.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  // Build unique indexes before allowing book and category writes.
  await Promise.all(Object.values(models).map((model) => model.init()));
};
