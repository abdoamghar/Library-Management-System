const { Book, Author, Category, Loan } = require('../models');
const helpers = require('./helpers');
const { flash } = require('../middleware/security');

async function renderForm(res, book = {}, errors = [], status = 200) {
  const [authors, categories] = await Promise.all([
    Author.find().sort('name').lean(),
    Category.find().sort('name').lean(),
  ]);
  return res.status(status).render('books/form', {
    title: book._id ? 'Edit book' : 'Add a book',
    book,
    authors,
    categories,
    selectedAuthors: (book.authors || []).map(String),
    selectedCategories: (book.categories || []).map(String),
    errors,
  });
}

exports.list = async (req, res) => {
  const search = res.locals.search;
  const filter = search ? { title: { $regex: helpers.escapeRegex(search), $options: 'i' } } : {};
  const paging = await helpers.getPagination(Book, filter, req.query);
  const books = await Book.find(filter)
    .sort('title')
    .skip(paging.skip)
    .limit(6)
    .populate('authors categories')
    .lean();

  res.render('books/list', { title: 'The collection', books, paging });
};

exports.new = async (req, res) => renderForm(res);

exports.edit = async (req, res) => {
  const book = await Book.findById(req.params.id).lean();

  if (!book) {
    helpers.throwError('Book not found.', 404);
  }

  return renderForm(res, book);
};

exports.show = async (req, res) => {
  const book = await Book.findById(req.params.id).populate('authors categories').lean();

  if (!book) {
    helpers.throwError('Book not found.', 404);
  }

  const loans = await Loan.find({ book: book._id }).sort('-borrowedAt').limit(10).lean();

  res.render('books/show', { title: book.title, book, loans });
};

exports.save = async (req, res) => {
  const data = {
    _id: req.params.id,
    title: helpers.readText(req.body.title, 160),
    isbn: helpers.readText(req.body.isbn, 13),
    description: helpers.readText(req.body.description),
    publicationYear: Number(req.body.publicationYear),
    totalCopies: Number(req.body.totalCopies),
    authors: [],
    categories: [],
  };

  try {
    data.authors = helpers.parseIds(req.body.authors);
    data.categories = helpers.parseIds(req.body.categories);

    await helpers.withTransaction(async (session) => {
      // Updating the versions stops an author/category deletion racing with this save.
      const authors = await Author.updateMany(
        { _id: { $in: data.authors } },
        { $inc: { __v: 1 } },
        { session },
      );
      const categories = await Category.updateMany(
        { _id: { $in: data.categories } },
        { $inc: { __v: 1 } },
        { session },
      );
      const missingAuthor = authors.matchedCount !== data.authors.length;
      const missingCategory = categories.matchedCount !== data.categories.length;

      if (missingAuthor || missingCategory) {
        helpers.throwError('A selected author or category no longer exists.');
      }

      const book = req.params.id ? await Book.findById(req.params.id).session(session) : new Book();

      if (!book) {
        helpers.throwError('Book not found.', 404);
      }

      let activeLoans = 0;

      if (!book.isNew) {
        activeLoans = await Loan.countDocuments({ book: book._id, returnedAt: null }).session(
          session,
        );
      }

      if (data.totalCopies < activeLoans) {
        helpers.throwError(
          `There are ${activeLoans} copies on loan. Return them before reducing the copy count.`,
        );
      }

      const { _id, ...fields } = data;
      book.set({ ...fields, availableCopies: data.totalCopies - activeLoans });

      await book.save({ session });
      data._id = book._id;
    });

    flash(req, 'success', req.params.id ? 'Book updated.' : 'Book added to the collection.');
    res.redirect(`/books/${data._id}`);
  } catch (error) {
    return renderForm(res, data, helpers.getFormErrors(error), error.status || 422);
  }
};

exports.remove = async (req, res) => {
  try {
    await helpers.withTransaction(async (session) => {
      const activeLoan = await Loan.exists({ book: req.params.id, returnedAt: null }).session(
        session,
      );

      if (activeLoan) {
        helpers.throwError('Return all borrowed copies before deleting this book.');
      }

      const book = await Book.findByIdAndDelete(req.params.id, { session });

      if (!book) {
        helpers.throwError('Book not found.', 404);
      }

      await Loan.deleteMany({ book: book._id }, { session });
    });
    flash(req, 'success', 'Book and its borrowing history deleted.');
  } catch (error) {
    flash(req, 'error', helpers.getFormErrors(error).join(' '));
  }

  res.redirect('/books');
};
