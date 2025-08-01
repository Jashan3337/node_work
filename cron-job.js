// cron-job.js

const cron = require("node-cron");

// Schedule task to run every 2 minutes
cron.schedule("*/2 * * * *", () => {
  console.log(
    `🕑 Task running every 2 minutes at ${new Date().toLocaleTimeString()}`
  );
});

console.log("🔁 Cron job scheduled to run every 2 minutes...");
