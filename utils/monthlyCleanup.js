// utils/monthlyCleanup.js
const fs = require('fs');
const moment = require('moment');
const Attendance = require('../models/Attendance');

const cleanupLogPath = './last-cleanup.json';
let isCleanupRunning = false;

const runMonthlyCleanup = async () => {
  if (isCleanupRunning) return;
  isCleanupRunning = true;

  try {
    const now = moment();
    const currentMonthStart = now.startOf('month');

    // Check if already cleaned this month
    if (fs.existsSync(cleanupLogPath)) {
      const lastCleanup = JSON.parse(fs.readFileSync(cleanupLogPath, 'utf-8'));

      if (
        lastCleanup.month === currentMonthStart.month() &&
        lastCleanup.year === currentMonthStart.year()
      ) {
        isCleanupRunning = false;
        return; // Already cleaned for this month
      }
    }

    // Delete all entries older than current month
    const result = await Attendance.deleteMany({
      date: { $lt: currentMonthStart.format('YYYY-MM-DD') },
    });

    console.log(`🧹 Deleted ${result.deletedCount} old records`);

    // Save cleanup log
    fs.writeFileSync(
      cleanupLogPath,
      JSON.stringify(
        {
          month: currentMonthStart.month(),
          year: currentMonthStart.year(),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error('❌ Error in monthly cleanup:', err);
  }

  isCleanupRunning = false;
};

module.exports = runMonthlyCleanup;
