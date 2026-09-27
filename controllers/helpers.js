const mongoose = require('mongoose');

function escapeRegex(value) {
  // Treat characters such as * and . as search text, not regex operators.
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getPagination(Model, filter, query) {
  const count = await Model.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(count / 6));
  const page = Math.min(pages, Math.max(1, parseInt(query.page, 10) || 1));
  return { count, pages, page, skip: (page - 1) * 6 };
}

async function withTransaction(callback) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(() => callback(session));
  } finally {
    await session.endSession();
  }
}

function throwError(message, status = 422) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function getFormErrors(error) {
  if (error.name === 'ValidationError') {
    return Object.values(error.errors).map((item) => item.message);
  }

  if (error.code === 11000) {
    return ['That ISBN or category name already exists.'];
  }

  if (error.status) {
    return [error.message];
  }

  // Unexpected errors go to Express's error handler.
  throw error;
}

function parseIds(value) {
  if (value == null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  for (const id of values) {
    if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) {
      throwError('Select valid related records.');
    }
  }

  return [...new Set(values)];
}

function readText(value, maxLength = 2000) {
  if (typeof value !== 'string') {
    return '';
  }

  // Keep one extra character so Mongoose can report an overlong value.
  return value.trim().slice(0, maxLength + 1);
}

module.exports = {
  escapeRegex,
  getPagination,
  withTransaction,
  throwError,
  getFormErrors,
  parseIds,
  readText,
};
