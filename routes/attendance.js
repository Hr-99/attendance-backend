const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const moment = require('moment-timezone');
const runMonthlyCleanup = require('../utils/monthlyCleanup');
const multer = require('multer');
const path = require('path');

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
    const { lat, lon } = req.body; // ✅ now works with multipart/form-data

    if (!lat || !lon || !req.file) {
      return res.status(400).json({ error: 'Latitude, longitude, and photo are required' });
    }

    const attendance = new Attendance({
      user: req.user.id,
      checkInLocation: {
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      },
      checkInPhoto: req.file.filename,
      checkInTime: new Date(),
        date: moment().tz("Asia/Kolkata").format("YYYY-MM-DD"),

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
    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon);
console.log('req.body:', req.body); // Should contain lat and lon
console.log('req.file:', req.file); // Should contain photo info

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).send("Latitude or Longitude missing or invalid.");
    }

    const nowIST = moment().tz('Asia/Kolkata');
    const dateIST = nowIST.format('YYYY-MM-DD');

    const attendance = await Attendance.findOne({ user: req.user.id, date: dateIST });
    if (!attendance || attendance.checkOutTime) {
      return res.status(400).send("Not checked in or already checked out");
    }

    attendance.checkOutTime = nowIST.toDate();
    attendance.checkOutLocation = { lat, lon };
    attendance.checkOutPhoto = req.file?.filename;

    await attendance.save();
    res.send("Checked out");
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).send("Server error");
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
