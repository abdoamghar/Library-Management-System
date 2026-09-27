const router = require('express').Router();
const books = require('../controllers/books');
const loans = require('../controllers/loans');
const entities = require('../controllers/entities');
const dashboard = require('../controllers/dashboard');
const { validId } = require('../middleware/security');

router.get('/', dashboard.index);
router.get('/dashboard', dashboard.index);

router.get('/books', books.list);
router.get('/books/new', books.new);
router.post('/books', books.save);
router.get('/books/:id', validId, books.show);
router.get('/books/:id/edit', validId, books.edit);
router.post('/books/:id', validId, books.save);
router.post('/books/:id/delete', validId, books.remove);

// Authors and categories share a controller, with their collection name passed in.
for (const kind of ['authors', 'categories']) {
  const controller = entities(kind);
  router.get(`/${kind}`, controller.list);
  router.get(`/${kind}/new`, controller.form);
  router.post(`/${kind}`, controller.save);
  router.get(`/${kind}/:id/edit`, validId, controller.form);
  router.post(`/${kind}/:id`, validId, controller.save);
  router.post(`/${kind}/:id/delete`, validId, controller.remove);
}

router.get('/loans', loans.list);
router.get('/loans/new', loans.new);
router.post('/loans', loans.create);
router.post('/loans/:id/return', validId, loans.return);

module.exports = router;
