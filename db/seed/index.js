require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { Author, Category, Book, Loan } = require('../../models');
const data = require('./data');
const { withTransaction } = require('../../controllers/helpers');
async function seed() {
  return withTransaction(async (session) => {
    // Operations sharing a transaction session must run sequentially.
    for (const Model of [Book, Author, Category, Loan]) {
      if (await Model.countDocuments().session(session))
        throw new Error(
          'Seeding requires an empty library database. Existing data was left untouched.',
        );
    }
    const authors = await Author.insertMany(
      data.authors.map(([name, biography]) => ({ name, biography })),
      { session },
    );
    const categories = await Category.insertMany(
      data.categories.map(([name, description]) => ({ name, description })),
      { session },
    );
    const books = await Book.insertMany(
      data.books.map(
        ([title, isbn, publicationYear, authorIds, categoryIds, description], index) => ({
          title,
          isbn,
          publicationYear,
          description,
          authors: authorIds.map((id) => authors[id]._id),
          categories: categoryIds.map((id) => categories[id]._id),
          totalCopies: 2 + (index % 3),
          availableCopies: 2 + (index % 3),
        }),
      ),
      { session },
    );
    const now = Date.now();
    const loanData = Array.from({ length: 18 }, (_, index) => {
      const borrowedAt = new Date(now - (index * 9 + 2) * 86400000);
      const active = index < 3;
      return {
        book: books[index % books.length]._id,
        borrowerName: ['Alex Morgan', 'Sam Taylor', 'Jordan Lee', 'Robin Blake'][index % 4],
        borrowerEmail: `reader${index + 1}@example.com`,
        borrowedAt,
        dueAt: new Date(borrowedAt.getTime() + 14 * 86400000),
        returnedAt: active ? null : new Date(borrowedAt.getTime() + 10 * 86400000),
      };
    });
    await Loan.insertMany(loanData, { session });
    for (const book of books.slice(0, 3))
      await Book.updateOne({ _id: book._id }, { $inc: { availableCopies: -1 } }, { session });
    return {
      books: books.length,
      authors: authors.length,
      categories: categories.length,
      loans: loanData.length,
    };
  });
}
module.exports = seed;
if (require.main === module) {
  require('../connect')(process.env.MONGODB_URI)
    .then(seed)
    .then((result) => console.log('Seeded:', result))
    .catch((error) => {
      console.error(
        'Seed failed:',
        error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[database URI]'),
      );
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
