const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const moment = require('moment-timezone');

// ✅ Check-In
router.post('/checkin', auth, async (req, res) => {
  try {
    const { lat, lon } = req.body;

    // Get current IST time
    const nowIST = moment().tz('Asia/Kolkata');
    const dateIST = nowIST.format('YYYY-MM-DD');

    const existing = await Attendance.findOne({ user: req.user.id, date: dateIST });
    if (existing && existing.checkInTime) {
      return res.status(400).send("Already checked in");
    }

    const attendance = new Attendance({
      user: req.user.id,
      checkInTime: nowIST.toDate(), // Save as IST time
      checkInLocation: { lat, lon },
      date: dateIST
    });

    await attendance.save();
    res.send("Checked in");
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).send("Server error");
  }
});

// ✅ Check-Out
router.post('/checkout', auth, async (req, res) => {
  try {
    const { lat, lon } = req.body;

    const nowIST = moment().tz('Asia/Kolkata');
    const dateIST = nowIST.format('YYYY-MM-DD');

    const attendance = await Attendance.findOne({ user: req.user.id, date: dateIST });
    if (!attendance || attendance.checkOutTime) {
      return res.status(400).send("Not checked in or already checked out");
    }

    attendance.checkOutTime = nowIST.toDate(); // Save as IST time
    attendance.checkOutLocation = { lat, lon };
    await attendance.save();

    res.send("Checked out");
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).send("Server error");
  }
});

// ✅ Admin Paginated View
// ✅ Admin Paginated Route with IST-formatted times
router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send("Access denied");

  try {
        await runMonthlyCleanup();
         // ⬅️ Trigger cleanup here

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.from && req.query.to) {
      filters.date = {
        $gte: req.query.from,
        $lte: req.query.to,
      };
    }
    if (req.query.user) {
      filters.user = req.query.user;
    }

    const [records, totalRecords] = await Promise.all([
      Attendance.find(filters)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email'),
      Attendance.countDocuments(filters),
    ]);

 const formatted = records.map((rec, index) => {
  const rawCheckIn = rec.checkInTime;
  const istCheckIn = rawCheckIn
    ? moment.utc(rawCheckIn).tz('Asia/Kolkata').format('hh:mm A')
    : null;

  // Log first record for debug
  if (index === 0) {
    console.log("🕓 Raw UTC:", rawCheckIn);
    console.log("🕕 IST:", istCheckIn);
  }

  return {
    _id: rec._id,
    user: rec.user,
    date: moment.utc(rec.date).tz('Asia/Kolkata').format('YYYY-MM-DD'),
    checkInTime: istCheckIn,
    checkOutTime: rec.checkOutTime
      ? moment.utc(rec.checkOutTime).tz('Asia/Kolkata').format('hh:mm A')
      : null,
    checkInLocation: rec.checkInLocation,
    checkOutLocation: rec.checkOutLocation,
  };
});


    res.json({
      data: formatted,
      page,
      totalPages: Math.ceil(totalRecords / limit),
      totalRecords,
    });
  } catch (err) {
    console.error('Pagination error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
