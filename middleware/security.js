const crypto = require('node:crypto');
const mongoose = require('mongoose');

const navigationLinks = [
  { url: '/', label: 'Overview' },
  { url: '/books', label: 'Books' },
  { url: '/authors', label: 'Authors' },
  { url: '/categories', label: 'Categories' },
  { url: '/loans', label: 'Borrowing' },
];

const searchPages = [
  { url: '/books', label: 'books', placeholder: 'book titles' },
  { url: '/authors', label: 'authors', placeholder: 'authors' },
  { url: '/categories', label: 'categories', placeholder: 'categories' },
  { url: '/loans', label: 'loans', placeholder: 'titles or borrowers' },
];

exports.context = (req, res, next) => {
  // Give each session its own token to protect submitted forms.
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrf = req.session.csrf;
  res.locals.flash = req.session.flash;

  // Flash messages appear once, after a redirect.
  delete req.session.flash;

  res.locals.path = req.path;
  res.locals.search = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
  res.locals.searchPage =
    searchPages.find((page) => req.path.startsWith(page.url)) || searchPages[0];
  res.locals.navigation = navigationLinks.map((link) => {
    const active =
      link.url === '/'
        ? req.path === '/' || req.path === '/dashboard'
        : req.path.startsWith(link.url);

    return { ...link, active };
  });

  next();
};

exports.csrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  if (req.body?._csrf !== req.session.csrf) {
    return res.status(403).render('error', {
      title: 'Form expired',
      message: 'Refresh the page and submit the form again.',
    });
  }

  next();
};

exports.validId = (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res
      .status(404)
      .render('error', { title: 'Not found', message: 'This library record does not exist.' });
  }

  next();
};

exports.flash = (req, type, message) => {
  req.session.flash = { type, message };
};
