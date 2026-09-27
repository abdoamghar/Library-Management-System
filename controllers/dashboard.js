const { Book, Author, Category, Loan } = require('../models');

function getRecentMonths() {
  const now = new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push(date.toISOString().slice(0, 7));
  }

  return months;
}

function getInventory() {
  return Book.aggregate([
    {
      $group: {
        _id: null,
        titles: { $sum: 1 },
        copies: { $sum: '$totalCopies' },
        available: { $sum: '$availableCopies' },
      },
    },
  ]);
}

function getBooksByCategory() {
  return Book.aggregate([
    // Count each category separately when a book has several categories.
    { $unwind: '$categories' },
    {
      $group: {
        _id: '$categories',
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    { $sort: { count: -1 } },
  ]);
}

function getMonthlyLoans(startDate) {
  return Loan.aggregate([
    { $match: { borrowedAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m',
            date: '$borrowedAt',
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

exports.index = async (req, res) => {
  const months = getRecentMonths();
  const startDate = new Date(`${months[0]}-01T00:00:00Z`);

  const [inventory, authors, categories, active, overdue, categoryCounts, monthlyLoans, recent] =
    await Promise.all([
      getInventory(),
      Author.countDocuments(),
      Category.countDocuments(),
      Loan.countDocuments({ returnedAt: null }),
      Loan.countDocuments({ returnedAt: null, dueAt: { $lt: new Date() } }),
      getBooksByCategory(),
      getMonthlyLoans(startDate),
      Loan.find({ returnedAt: null }).sort('dueAt').limit(5).populate('book').lean(),
    ]);

  const totals = inventory[0] || { titles: 0, copies: 0, available: 0 };
  const stats = { ...totals, authors, categories, active, overdue };

  const statCards = [
    { label: 'Book titles', value: stats.titles, note: `${stats.copies} copies in the collection` },
    { label: 'Available copies', value: stats.available, note: 'Ready for their next reader' },
    {
      label: 'On loan',
      value: stats.active,
      note: `${stats.overdue} overdue · check the borrowing desk`,
    },
    {
      label: 'Authors',
      value: stats.authors,
      note: `${stats.categories} categories on the shelves`,
    },
  ];

  // Include quiet months as zero so the line chart has all six months.
  const monthlyCounts = months.map((month) => {
    const result = monthlyLoans.find((loan) => loan._id === month);
    return result ? result.count : 0;
  });

  const chartData = {
    categories: {
      labels: categoryCounts.map((category) => category.category.name),
      values: categoryCounts.map((category) => category.count),
    },
    activity: {
      labels: months,
      values: monthlyCounts,
    },
    availability: [stats.available, stats.active],
  };

  res.render('dashboard', {
    title: 'Library overview',
    stats,
    statCards,
    recent,
    chartData,
  });
};
