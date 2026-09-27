const { Author, Category, Book } = require('../models');
const helpers = require('./helpers');
const { flash } = require('../middleware/security');

function createEntityController(kind) {
  const Model = kind === 'authors' ? Author : Category;
  const singular = kind === 'authors' ? 'Author' : 'Category';
  const detail = kind === 'authors' ? 'biography' : 'description';
  const nameLimit = kind === 'authors' ? 100 : 60;
  const detailLimit = kind === 'authors' ? 1500 : 300;

  // Authors and categories use the same forms and CRUD steps.
  return {
    list: async (req, res) => {
      const filter = res.locals.search
        ? { name: { $regex: helpers.escapeRegex(res.locals.search), $options: 'i' } }
        : {};
      const paging = await helpers.getPagination(Model, filter, req.query);
      const items = await Model.find(filter).sort('name').skip(paging.skip).limit(6).lean();
      const counts = await Book.aggregate([
        { $unwind: `$${kind}` },
        { $group: { _id: `$${kind}`, count: { $sum: 1 } } },
      ]);
      const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row.count]));

      res.render('entities/list', {
        title: kind === 'authors' ? 'The authors' : 'The shelves',
        kind,
        singular,
        detail,
        items,
        countMap,
        paging,
      });
    },

    form: async (req, res) => {
      const item = req.params.id ? await Model.findById(req.params.id).lean() : {};

      if (!item) {
        helpers.throwError(`${singular} not found.`, 404);
      }

      res.render('entities/form', {
        title: `${item._id ? 'Edit' : 'Add'} ${singular.toLowerCase()}`,
        kind,
        singular,
        detail,
        item,
        errors: [],
      });
    },

    save: async (req, res) => {
      const item = {
        _id: req.params.id,
        name: helpers.readText(req.body.name, nameLimit),
        [detail]: helpers.readText(req.body[detail], detailLimit),
      };

      try {
        const record = req.params.id ? await Model.findById(req.params.id) : new Model();

        if (!record) {
          helpers.throwError(`${singular} not found.`, 404);
        }

        record.set({ name: item.name, [detail]: item[detail] });
        await record.save();

        flash(req, 'success', `${singular} saved.`);
        res.redirect(`/${kind}`);
      } catch (error) {
        res.status(error.status || 422).render('entities/form', {
          title: `Save ${singular.toLowerCase()}`,
          kind,
          singular,
          detail,
          item,
          errors: helpers.getFormErrors(error),
        });
      }
    },

    remove: async (req, res) => {
      await helpers.withTransaction(async (session) => {
        const item = await Model.findByIdAndDelete(req.params.id, { session });
        if (!item) {
          helpers.throwError(`${singular} not found.`, 404);
        }

        // Keep the books, but remove the deleted author or category from their lists.
        await Book.updateMany({ [kind]: item._id }, { $pull: { [kind]: item._id } }, { session });
      });

      flash(req, 'success', `${singular} deleted and removed from related books.`);
      res.redirect(`/${kind}`);
    },
  };
}

module.exports = createEntityController;
