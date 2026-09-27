const { Book, Loan } = require('../models');
const helpers = require('./helpers');
const { flash } = require('../middleware/security');

async function renderForm(res, values = {}, errors = [], status = 200) {
  const books = await Book.find({ availableCopies: { $gt: 0 } })
    .sort('title')
    .lean();
  res.status(status).render('loans/form', { title: 'Borrow a book', books, values, errors });
}

function parseDueDate(value) {
  const errorMessage = 'Choose a valid due date today or later.';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    helpers.throwError(errorMessage);
  }

  // A loan is due at the end of the selected day, in UTC.
  const dueDate = new Date(`${value}T23:59:59.999Z`);

  if (!Number.isFinite(dueDate.getTime())) {
    helpers.throwError(errorMessage);
  }

  if (dueDate.toISOString().slice(0, 10) !== value || dueDate < new Date()) {
    helpers.throwError(errorMessage);
  }

  return dueDate;
}

exports.list = async (req, res) => {
  let filter = {};
  if (res.locals.search) {
    const books = await Book.find({
      title: { $regex: helpers.escapeRegex(res.locals.search), $options: 'i' },
    }).select('_id');
    filter = {
      $or: [
        { book: { $in: books.map((book) => book._id) } },
        { borrowerName: { $regex: helpers.escapeRegex(res.locals.search), $options: 'i' } },
      ],
    };
  }
  const paging = await helpers.getPagination(Loan, filter, req.query);
  const loans = await Loan.find(filter)
    .sort({ returnedAt: 1, dueAt: 1 })
    .skip(paging.skip)
    .limit(6)
    .populate('book')
    .lean();
  res.render('loans/list', { title: 'Borrowing desk', loans, paging });
};
exports.new = async (req, res) => renderForm(res, { book: req.query.book || '' });

exports.create = async (req, res) => {
  const values = {
    book: helpers.readText(req.body.book, 24),
    borrowerName: helpers.readText(req.body.borrowerName, 100),
    borrowerEmail: helpers.readText(req.body.borrowerEmail, 254),
    dueAt: helpers.readText(req.body.dueAt, 10),
  };
  try {
    const bookId = helpers.parseIds(values.book)[0];
    const dueAt = parseDueDate(values.dueAt);

    await helpers.withTransaction(async (session) => {
      // Check availability and reduce it together so two readers cannot take the last copy.
      const book = await Book.findOneAndUpdate(
        { _id: bookId, availableCopies: { $gt: 0 } },
        { $inc: { availableCopies: -1 } },
        { returnDocument: 'after', session },
      );
      if (!book) {
        helpers.throwError('This book is no longer available. Choose another book.');
      }

      await Loan.create([{ ...values, book: bookId, dueAt }], { session });
    });
    flash(req, 'success', 'Loan recorded. Enjoy the book!');
    res.redirect('/loans');
  } catch (error) {
    return renderForm(res, values, helpers.getFormErrors(error), error.status || 422);
  }
};

exports.return = async (req, res) => {
  await helpers.withTransaction(async (session) => {
    // Only update active loans; returning the same loan twice must not add another copy.
    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, returnedAt: null },
      { $set: { returnedAt: new Date() } },
      { returnDocument: 'after', session },
    );
    if (!loan) {
      helpers.throwError('This loan was already returned or does not exist.', 409);
    }

    await Book.updateOne({ _id: loan.book }, { $inc: { availableCopies: 1 } }, { session });
  });
  flash(req, 'success', 'Book returned. The copy is available again.');
  res.redirect('/loans');
};
