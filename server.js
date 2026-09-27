require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connect = require('./db/connect');
async function main() {
  await connect(process.env.MONGODB_URI);
  const app = require('./app')({ mongoUrl: process.env.MONGODB_URI });
  const server = app.listen(process.env.PORT || 3000, () =>
    console.log(`Chapter House: http://localhost:${process.env.PORT || 3000}`),
  );
  const shutdown = () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(async (error) => {
  console.error(
    'Could not start:',
    error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[database URI]'),
  );
  await mongoose.disconnect();
  process.exitCode = 1;
});
