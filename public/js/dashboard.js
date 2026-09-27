// The controller adds the chart data to the page as JSON.
const chartData = JSON.parse(document.querySelector('#chart-data').textContent);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const animation = reducedMotion ? false : { duration: 700 };

Chart.defaults.color = '#5a6259';
Chart.defaults.font.family = 'Trebuchet MS, sans-serif';

// Bar chart: number of book titles in each category.
new Chart(document.querySelector('#category-chart'), {
  type: 'bar',
  data: {
    labels: chartData.categories.labels,
    datasets: [
      {
        label: 'Book titles',
        data: chartData.categories.values,
        backgroundColor: '#315a46',
        borderRadius: 3,
        maxBarThickness: 35,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: '#e5e4da' },
      },
      x: {
        grid: { display: false },
        ticks: { maxRotation: 40, minRotation: 0 },
      },
    },
  },
});

const monthLabels = chartData.activity.labels.map((month) => {
  const date = new Date(`${month}-01T00:00:00Z`);
  return date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
});

// Line chart: borrowing activity over the last six months.
new Chart(document.querySelector('#activity-chart'), {
  type: 'line',
  data: {
    labels: monthLabels,
    datasets: [
      {
        label: 'Loans',
        data: chartData.activity.values,
        borderColor: '#b56548',
        backgroundColor: '#b5654815',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#b56548',
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: '#e5e4da' },
      },
      x: {
        grid: { display: false },
      },
    },
  },
});
