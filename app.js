const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const { rateLimit } = require('express-rate-limit');
const security = require('./middleware/security');

module.exports = function createApp({
  mongoUrl,
  sessionSecret = process.env.SESSION_SECRET,
  memorySessions = false,
} = {}) {
  const app = express();
  const production = process.env.NODE_ENV === 'production';
  if (production && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error('Production requires a SESSION_SECRET of at least 32 characters.');
  }

  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Serve styles and scripts locally so the app does not need CDN requests.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'upgrade-insecure-requests': production ? [] : null,
        },
      },
    }),
  );
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/vendor/chart.js', (req, res) =>
    res.sendFile(path.join(__dirname, 'node_modules/chart.js/dist/chart.umd.js')),
  );
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  // Normal runs store sessions in MongoDB; the demo and tests use memory.
  app.use(
    session({
      name: 'chapter.sid',
      secret: sessionSecret || crypto.randomBytes(48).toString('hex'),
      resave: false,
      saveUninitialized: false,
      store: memorySessions ? undefined : MongoStore.create({ mongoUrl, ttl: 86400 }),
      cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 86400000 },
    }),
  );

  app.use(security.context);
  app.use(
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use(security.csrf);
  app.use(require('./routes'));

  app.use((req, res) =>
    res
      .status(404)
      .render('error', { title: 'Page not found', message: 'That page is not in our collection.' }),
  );

  // Express 5 forwards rejected async controller promises to this handler.
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const status = error.status || 500;

    if (status >= 500) {
      console.error('Request failed:', error.name);
    }

    res.status(status).render('error', {
      title: status >= 500 ? 'Something went wrong' : 'Unable to complete action',
      message:
        status >= 500
          ? 'Please try again. Check the server and database connection if this continues.'
          : error.message,
    });
  });

  return app;
};
