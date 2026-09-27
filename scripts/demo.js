require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
async function main() {
  console.log('Starting local demo MongoDB. The first run downloads a MongoDB binary.');
  const database = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  try {
    await require('../db/connect')(database.getUri('chapter_house_demo'));
    console.log('Sample library:', await require('../db/seed')());
    const app = require('../app')({ memorySessions: true });
    const server = app.listen(process.env.PORT || 3000, () =>
      console.log(
        `Demo ready: http://localhost:${process.env.PORT || 3000}\nDemo data is temporary and resets when this process stops.`,
      ),
    );
    const shutdown = () =>
      server.close(async () => {
        await mongoose.disconnect();
        await database.stop();
        process.exit(0);
      });
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    server.on('error', async (error) => {
      console.error(error.message);
      await mongoose.disconnect();
      await database.stop();
      process.exitCode = 1;
    });
  } catch (error) {
    await mongoose.disconnect();
    await database.stop();
    throw error;
  }
}
main().catch((error) => {
  console.error('Demo failed:', error.message);
  process.exitCode = 1;
});
