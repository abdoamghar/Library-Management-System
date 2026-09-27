# Chapter House · Library Management

A full-stack library application built with Express 5, MongoDB, Mongoose, EJS, Tailwind CSS, and Chart.js. All mandatory assignment features are included; optional authentication, uploads, ratings, exports, and advanced search are intentionally out of scope.

## Quick start (local demo)

Use Node.js 22.12 or newer and npm. From this folder:

```sh
npm install
npm run build:css
npm run demo
```

Open http://localhost:3000. The demo starts a real temporary MongoDB replica set and seeds 13 books, 12 authors, 10 categories, and 18 borrowing records. The first run downloads the MongoDB binary and requires internet access. **Demo data resets when the process stops.** Use the setup below for persistent data. The temporary database and session store are for local development only; never deploy the demo publicly.

## Persistent MongoDB setup

1. Create a MongoDB Atlas database, or run MongoDB locally as a replica set. Transactions require a replica set (a standalone MongoDB server is insufficient).
2. Copy `.env.example` to `.env`. Set `MONGODB_URI` to your private connection string and `SESSION_SECRET` to a random value of at least 32 characters. `.env` is ignored by Git.
3. Run `npm install` and `npm run build:css`.
4. Run `npm run seed` against a **new, empty database**. The seed refuses to modify an existing collection. There is no destructive reset command.
5. Run `npm run dev` for automatic server restarts or `npm start` for normal startup.

Example local MongoDB configuration, assuming MongoDB is installed and `mongod`/`mongosh` are on your PATH:

```sh
mongod --replSet rs0 --dbpath <existing-data-directory> --bind_ip 127.0.0.1
mongosh --eval "rs.initiate()"
```

Then use `mongodb://127.0.0.1:27017/chapter_house?replicaSet=rs0` in your local `.env`. Wait for the primary to be elected before seeding. Never commit real connection credentials. For production, set `NODE_ENV=production`, use HTTPS, and configure Express's `trust proxy` only to match your trusted deployment proxy if TLS terminates there (secure session cookies otherwise require HTTPS directly). Authentication is intentionally absent, so anyone with access can manage records: restrict access to a trusted network.

## Using the application

- **Overview:** inventory counts, authors/categories, active/overdue loans, Chart.js category and monthly borrowing charts, and next books due. Chart data is also available as accessible text.
- **Books:** title search, six books per page, details, add/edit, multiple authors and categories, and confirmed deletion.
- **Authors / Categories:** name search, six records per page, add/edit, relationship counts, and confirmed deletion.
- **Borrowing:** search by title or borrower, six records per page, lend available copies, and return loans. Borrowing requires a reader name, email, and valid due date. The default loan period is 14 days. No email is sent.

Deleting an author or category removes its references from every book and keeps the books. Books can have no assigned authors/categories after removal. Deleting a book is blocked while copies are on loan; once all copies are returned, the book and its borrowing history are deleted together. Returns are idempotent: repeat submissions never increase the copy count twice. Copy counts cannot be reduced below active loans. Borrowing and inventory changes run in MongoDB transactions with an atomic availability check.

## Schema

| Collection   | Fields and constraints                                                                                                                                                                                | Relationships                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `books`      | `title` required, max 160; `isbn` unique 13 digits; `publicationYear` integer 1450–next year; `description` max 2000; `totalCopies` integer 1–1000; `availableCopies` nonnegative integer; timestamps | `authors: ObjectId[] → authors`, `categories: ObjectId[] → categories` |
| `authors`    | `name` required, max 100; `biography` max 1500; timestamps                                                                                                                                            | Inverse relationship obtained by querying `books.authors`              |
| `categories` | `name` required, unique, max 60; `description` max 300; timestamps                                                                                                                                    | Inverse relationship obtained by querying `books.categories`           |
| `loans`      | `borrowerName` required, max 100; `borrowerEmail` required, max 254, validated; `borrowedAt`, `dueAt` required; `returnedAt` nullable; timestamps                                                     | `book: ObjectId → books`; index on book and on return/due dates        |
| `sessions`   | Expiring server-side session data managed by connect-mongo                                                                                                                                            | Browser holds only the signed, HTTP-only session ID                    |

Books and authors have a many-to-many relationship: a book can have multiple authors and an author can write multiple books. The same applies to books and categories. Sample anthology “Voices of the English Novel” demonstrates multiple authors. ISBN validation checks the required digit format, not the optional ISBN checksum; the anthology has a synthetic sample ISBN.

Aggregation pipelines use `$group` to total copies, `$unwind`/`$lookup` to group books by category, and `$dateToString` to group loans by month. Charts use UTC months. A book assigned to multiple categories counts in each category; chart totals can exceed the number of titles. Due dates are interpreted as the end of the selected UTC day.

## Project structure

```text
app.js                   Express setup and middleware
server.js                Persistent database startup
controllers/             Books, authors/categories, loans, statistics
models/                  One schema per model, with shared exports in index.js
routes/                  Server-rendered CRUD routes
middleware/              Session context, CSRF, flash messages, ID checks
db/connect.js            Connection and index initialization
db/seed/                 Safe sample data seeding
views/                   EJS pages and shared partials
public/css/              Tailwind source and generated CSS
public/js/               Navigation, deletion dialog, Chart.js setup
scripts/demo.js          Temporary local MongoDB demo
test/                    Integration tests against real MongoDB
```

## Validation and security

Server-side allowlisted fields and Mongoose constraints validate writes; forms preserve input and show errors. Relationship IDs are validated and checked against the database. Search expressions are escaped and never accept query objects. EJS escapes user text, and chart JSON escapes `<` before embedding. CSRF tokens protect every write. Helmet provides security headers and a self-only Content Security Policy. Charts and CSS are served locally. Sessions use HTTP-only, SameSite=Lax cookies and MongoDB storage outside the demo. Rate limiting and a 32 KB form-body limit constrain requests. Error pages do not expose database details or stack traces. Persistent startup initializes unique indexes before handling writes.

## Verification and development

```sh
npm test
npm run build:css
npm audit
```

Tests start their own isolated temporary replica set; no configured application database is modified. They check seeding, all screens, pagination, literal search, CSRF, validation, duplicate ISBNs, missing relationship IDs, book and secondary-entity CRUD, atomic concurrent borrowing, inventory rollback, repeated returns, deletion restrictions/cascades, aggregate counts, and escaped output. First test run requires the MongoDB binary download.

After changing templates or styles, rebuild CSS. Use clear commits such as `feat: add book management and borrowing` or `test: cover concurrent borrowing and cascade deletion`. Review changes and exclude `.env`, dependencies, temporary data, and logs from commits.
