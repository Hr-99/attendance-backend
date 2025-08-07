const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const moment = require('moment-timezone');
const runMonthlyCleanup = require('../utils/monthlyCleanup');
const multer = require('multer');
const path = require('path');
const { error } = require('console');

// ✅ Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// ✅ Check-In

router.post('/checkin', auth, upload.single('photo'), async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (!lat || !lon || !req.file) {
      return res.status(400).json({ error: 'Latitude, longitude, and photo are required' });
    }

    // Step 1: Get today's start and end in IST, convert to UTC
    const startOfTodayUTC = moment.tz('Asia/Kolkata').startOf('day').utc().toDate();
    const endOfTodayUTC = moment.tz('Asia/Kolkata').endOf('day').utc().toDate();

    // Step 2: Check if already checked in today
    const existing = await Attendance.findOne({
      user: req.user.id,
      checkInTime: { $gte: startOfTodayUTC, $lte: endOfTodayUTC }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already checked in today' }); // ✅ 200 with message
    }

    // Step 3: Save new check-in
    const attendance = new Attendance({
      user: req.user.id,
      checkInTime: new Date(),
      checkInLocation: { lat: parseFloat(lat), lon: parseFloat(lon) },
      checkInPhoto: req.file.filename
    });

    await attendance.save();

    res.status(201).json({ message: 'Check-in successful' });

  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Server error during check-in' });
  }
});





// ✅ Check-Out
router.post('/checkout', auth, upload.single('photo'), async (req, res) => {
  try {
    const { lat, lon } = req.body;

    if (!lat || !lon || !req.file) {
      return res.status(400).json({ error: 'Latitude, longitude, and photo are required' });
    }

    const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

    // 📦 Find today's attendance record
    const attendance = await Attendance.findOne({
      user: req.user.id,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({ error: 'No check-in found for today' });
    }

    // 🔐 Prevent double check-out
    if (attendance.checkOutTime) {
  return res.status(400).json({ error: 'Already checked in today' });
    }

    // ✅ Proceed to update
    attendance.checkOutLocation = {
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    };
    attendance.checkOutPhoto = req.file.filename;
    attendance.checkOutTime = new Date();

    await attendance.save();

    res.status(200).json({ message: 'Check-out successful' });

  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Server error during check-out' });
  }
});



// ✅ Admin route with duration (unchanged from working version)
router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send("Access denied");

  try {
    await runMonthlyCleanup();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

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

    let recordsQuery = Attendance.find(filters).sort({ date: -1 }).populate('user', 'name email');

    if (!(page === 0 && limit === 0)) {
      const skip = (page - 1) * limit;
      recordsQuery = recordsQuery.skip(skip).limit(limit);
    }

    const [records, totalRecords] = await Promise.all([
      recordsQuery,
      Attendance.countDocuments(filters),
    ]);

    const formatted = records.map((rec, index) => {
      const rawCheckIn = rec.checkInTime;
      const rawCheckOut = rec.checkOutTime;

      const istCheckIn = rawCheckIn
        ? moment.utc(rawCheckIn).tz('Asia/Kolkata').format('hh:mm A')
        : null;

      const istCheckOut = rawCheckOut
        ? moment.utc(rawCheckOut).tz('Asia/Kolkata').format('hh:mm A')
        : null;

      let duration = null;
      if (rawCheckIn && rawCheckOut) {
        const checkIn = moment.utc(rawCheckIn);
        const checkOut = moment.utc(rawCheckOut);
        const diff = moment.duration(checkOut.diff(checkIn));

        const hours = Math.floor(diff.asHours());
        const minutes = Math.floor(diff.minutes());

        duration = `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
      }

      if (index === 0) {
        console.log("\uD83D\uDD53 Raw UTC Check-in:", rawCheckIn);
        console.log("\uD83D\uDD56 IST Check-in:", istCheckIn);
        console.log("\uD83D\uDD53 Raw UTC Check-out:", rawCheckOut);
        console.log("\uD83D\uDD56 IST Check-out:", istCheckOut);
        console.log("\u23F1️ Duration:", duration);
      }

      return {
        _id: rec._id,
        user: rec.user,
        date: moment.utc(rec.date).tz('Asia/Kolkata').format('YYYY-MM-DD'),
        checkInTime: istCheckIn,
        checkOutTime: istCheckOut,
        duration,
        checkInLocation: rec.checkInLocation,
        checkOutLocation: rec.checkOutLocation,
          checkInPhoto: rec.checkInPhoto || null,
  checkOutPhoto: rec.checkOutPhoto || null,
      };
    });

    res.json({
      data: formatted,
      page: page === 0 ? 1 : page,
      totalPages: page === 0 ? 1 : Math.ceil(totalRecords / limit),
      totalRecords,
    });
  } catch (err) {
    console.error('Pagination error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
