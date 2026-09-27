const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const { Book, Author, Category, Loan } = require('../models');
let database, app, agent, csrf;
before(
  async () => {
    database = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await require('../db/connect')(database.getUri('library_test'));
    await require('../db/seed')();
    app = require('../app')({
      memorySessions: true,
      sessionSecret: 'test-secret-that-is-long-enough-for-tests',
    });
    agent = request.agent(app);
    const response = await agent.get('/books/new').expect(200);
    csrf = response.text.match(/name="_csrf"\s+value="([^"]+)"/)[1];
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});
test('seed includes at least ten primary and secondary records, with shared references', async () => {
  assert.equal(await Book.countDocuments(), 13);
  assert.equal(await Author.countDocuments(), 12);
  assert.equal(await Category.countDocuments(), 10);
  assert.ok(await Book.exists({ 'authors.1': { $exists: true } }));
  await assert.rejects(require('../db/seed')(), /empty library/);
});
test('all screens render, pagination is six items, and title search is literal', async () => {
  for (const url of [
    '/',
    '/dashboard',
    '/authors',
    '/categories',
    '/loans',
    '/authors/new',
    '/categories/new',
    '/loans/new',
  ])
    await agent.get(url).expect(200);
  let response = await agent.get('/books').expect(200);
  assert.equal((response.text.match(/class="book-card"/g) || []).length, 6);
  response = await agent.get('/books?page=2').expect(200);
  assert.match(response.text, /Showing\s+7–12\s+of\s+13/);
  response = await agent.get('/books?q=Frankenstein').expect(200);
  assert.equal((response.text.match(/class="book-card"/g) || []).length, 1);
  response = await agent.get('/books?q=.*').expect(200);
  assert.match(response.text, /No books found/);
  await agent.get('/books/not-an-id').expect(404);
  await agent.get('/missing').expect(404);
});
test('CSRF and invalid records are rejected without writes; errors preserve user input', async () => {
  await agent.post('/books').type('form').send({ title: 'Bad' }).expect(403);
  const author = await Author.findOne();
  const count = await Book.countDocuments();
  let response = await agent
    .post('/books')
    .type('form')
    .send({
      _csrf: csrf,
      title: 'Keep my input',
      isbn: 'bad',
      publicationYear: 1800,
      totalCopies: 2,
      authors: String(author._id),
    })
    .expect(422);
  assert.match(response.text, /Keep my input/);
  assert.match(response.text, /ISBN/);
  response = await agent
    .post('/books')
    .type('form')
    .send({
      _csrf: csrf,
      title: 'Invalid reference',
      isbn: '9780000000012',
      publicationYear: 2000,
      totalCopies: 1,
      authors: String(new mongoose.Types.ObjectId()),
    })
    .expect(422);
  assert.match(response.text, /no longer exists/);
  assert.equal(await Book.countDocuments(), count);
});
test('book CRUD, safe copy edits, loan concurrency, idempotent returns, and cascade deletion', async () => {
  const author = await Author.findOne();
  const category = await Category.findOne();
  const fields = {
    _csrf: csrf,
    title: 'Integration Book',
    isbn: '9780000000012',
    publicationYear: 2020,
    totalCopies: 1,
    authors: String(author._id),
    categories: String(category._id),
  };
  await agent.post('/books').type('form').send(fields).expect(302);
  const book = await Book.findOne({ isbn: fields.isbn });
  await agent.get(`/books/${book._id}`).expect(200);
  await agent.get(`/books/${book._id}/edit`).expect(200);
  await agent.post('/books').type('form').send(fields).expect(422);
  // Invalid loan creation must roll back the inventory decrement.
  await agent
    .post('/loans')
    .type('form')
    .send({
      _csrf: csrf,
      book: String(book._id),
      borrowerName: 'Reader',
      borrowerEmail: 'bad',
      dueAt: '2099-01-01',
    })
    .expect(422);
  assert.equal((await Book.findById(book._id)).availableCopies, 1);
  const loanFields = {
    _csrf: csrf,
    book: String(book._id),
    borrowerName: 'Reader',
    borrowerEmail: 'reader@example.com',
    dueAt: '2099-01-01',
  };
  const results = await Promise.all([
    agent.post('/loans').type('form').send(loanFields),
    agent.post('/loans').type('form').send(loanFields),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [302, 422]);
  assert.equal((await Book.findById(book._id)).availableCopies, 0);
  assert.equal(await Loan.countDocuments({ book: book._id }), 1);
  await agent.post(`/books/${book._id}/delete`).type('form').send({ _csrf: csrf }).expect(302);
  assert.ok(await Book.exists({ _id: book._id }));
  await agent
    .post(`/books/${book._id}`)
    .type('form')
    .send({ ...fields, totalCopies: 0 })
    .expect(422);
  const loan = await Loan.findOne({ book: book._id });
  await agent.post(`/loans/${loan._id}/return`).type('form').send({ _csrf: csrf }).expect(302);
  await agent.post(`/loans/${loan._id}/return`).type('form').send({ _csrf: csrf }).expect(409);
  assert.equal((await Book.findById(book._id)).availableCopies, 1);
  await agent
    .post(`/books/${book._id}`)
    .type('form')
    .send({ ...fields, title: 'Updated title', totalCopies: 3 })
    .expect(302);
  assert.equal((await Book.findById(book._id)).availableCopies, 3);
  await agent.post(`/books/${book._id}/delete`).type('form').send({ _csrf: csrf }).expect(302);
  assert.equal(await Book.countDocuments({ _id: book._id }), 0);
  assert.equal(await Loan.countDocuments({ book: book._id }), 0);
});
test('author and category CRUD removes references but preserves shared books', async () => {
  for (const [kind, Model, detail] of [
    ['authors', Author, 'biography'],
    ['categories', Category, 'description'],
  ]) {
    await agent
      .post(`/${kind}`)
      .type('form')
      .send({ _csrf: csrf, name: 'Temporary record', [detail]: 'Test description' })
      .expect(302);
    const item = await Model.findOne({ name: 'Temporary record' });
    await agent.get(`/${kind}/${item._id}/edit`).expect(200);
    await agent
      .post(`/${kind}/${item._id}`)
      .type('form')
      .send({ _csrf: csrf, name: 'Updated record', [detail]: 'Updated description' })
      .expect(302);
    const book = await Book.findOne();
    await Book.updateOne({ _id: book._id }, { $addToSet: { [kind]: item._id } });
    await agent.post(`/${kind}/${item._id}/delete`).type('form').send({ _csrf: csrf }).expect(302);
    assert.equal(await Model.countDocuments({ _id: item._id }), 0);
    assert.ok(await Book.exists({ _id: book._id }));
    assert.equal(await Book.countDocuments({ [kind]: item._id }), 0);
  }
});
test('dashboard aggregates reflect inventory and loans and escapes stored text', async () => {
  const book = await Book.findOne();
  await Book.updateOne({ _id: book._id }, { title: '<script>alert(1)</script>' });
  const response = await agent.get('/').expect(200);
  const data = JSON.parse(
    response.text.match(/id="chart-data" type="application\/json">(.*?)<\/script>/s)[1],
  );
  const inventory = await Book.aggregate([
    { $group: { _id: null, available: { $sum: '$availableCopies' } } },
  ]);
  assert.equal(data.availability[0], inventory[0].available);
  assert.equal(data.availability[1], await Loan.countDocuments({ returnedAt: null }));
  const detail = await agent.get(`/books/${book._id}`).expect(200);
  assert.match(detail.text, /&lt;script&gt;/);
  assert.doesNotMatch(detail.text, /<script>alert/);
});
