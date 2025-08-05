const cron = require('node-cron');
const moment = require('moment-timezone');
const Attendance = require('./models/Attendance'); 

function startAttendanceCleanupJob() {
  cron.schedule('0 0 1 * *', async () => {
    const today = moment().tz('Asia/Kolkata');
    const lastMonth = today.subtract(1, 'month').format('YYYY-MM');

    try {
      const result = await Attendance.deleteMany({
        date: { $regex: `^${lastMonth}` }
      });
      console.log(`🧹 Deleted ${result.deletedCount} entries from ${lastMonth}`);
    } catch (err) {
      console.error('Cleanup failed:', err.message);
    }
  });
}

module.exports = { startAttendanceCleanupJob };
