# Library Management System

Chapter House is a library management app for the Express and MongoDB project. It lets you manage books, authors, categories, and borrowing records.

The backend uses Node.js, Express, and Mongoose. The pages use EJS and Tailwind CSS, and the dashboard charts use Chart.js.

## Features

- Add, edit, and delete books, authors, and categories
- Search books by title and authors or categories by name
- Show 6 records per page
- Borrow books and mark them as returned
- Check available copies and overdue loans
- View statistics and charts on the dashboard
- Form validation, confirmation before deleting, and success or error messages
- Responsive pages with a mobile menu

The optional assignment features are not included yet.

## Setup

You need Node.js 22.12 or newer and a MongoDB database. MongoDB Atlas works, or you can use a local replica set. A replica set is needed for database transactions.

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project folder:

   ```env
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_random_secret
   PORT=3000
   ```

   Use a random session secret of at least 32 characters. Keep `.env` private; it is excluded by `.gitignore`.

3. Build the CSS:

   ```sh
   npm run build:css
   ```

4. For a new, empty database, add the sample data:

   ```sh
   npm run seed
   ```

   This adds 13 books, 12 authors, 10 categories, and 18 borrowing records. It stops if the database already contains library records.

5. Start the app:

   ```sh
   npm start
   ```

Open [http://localhost:3000](http://localhost:3000). You can also use `npm run dev` to restart the server automatically when you edit the code.

## Database

| Collection | Main fields |
| --- | --- |
| Books | Title, unique 13-digit ISBN, publication year, description, total copies, available copies, author IDs, category IDs |
| Authors | Name and biography |
| Categories | Unique name and description |
| Loans | Book ID, borrower name and email, borrowing date, due date, return date |

Names and descriptions are strings, copy counts and publication years are integers, and loan dates use the Date type. Mongoose validates required fields and field limits. Sessions are stored separately in MongoDB.

A book can have several authors and categories. Authors and categories can also belong to several books. These relationships use arrays of Mongoose ObjectId references. Each loan references one book.

Deleting an author or category removes its references from books without deleting the books. A book cannot be deleted while it is borrowed. Once all copies are returned, deleting the book also deletes its loan history.

The dashboard uses MongoDB aggregate queries to count copies, group books by category, and group borrowing records by month.

## Folders

- `models/` — Mongoose schemas
- `controllers/` — CRUD, borrowing, and dashboard logic
- `routes/` — Express routes
- `middleware/` — Validation of IDs, CSRF protection, and flash messages
- `db/` — Database connection and sample data
- `views/` — EJS pages
- `public/` — CSS, browser JavaScript, and favicon
- `test/` — Automated tests
- `scripts/` — Local demo setup

## Testing

Run `npm test` to check CRUD, validation, borrowing, deletion, and dashboard statistics. Tests use a separate temporary database. The first run needs internet access to download MongoDB.

For a quick demo without configuring your own database, run `npm run demo`. It uses sample data in a temporary database, so changes are lost when the demo stops.

Rebuild the CSS with `npm run build:css` after changing styles or Tailwind classes.
