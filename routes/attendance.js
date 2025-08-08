const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const moment = require('moment-timezone');
const runMonthlyCleanup = require('../utils/monthlyCleanup');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ✅ Use memoryStorage for multer
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Helper to upload buffer to Cloudinary
const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: `attendance/${filename}`,
        folder: 'attendance',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// ✅ Check-In
router.post('/checkin', auth, upload.single('photo'), async (req, res) => {
  try {
    const { lat, lon } = req.body;

    if (!lat || !lon || !req.file) {
      return res.status(400).json({ error: 'Latitude, longitude, and photo are required' });
    }

    const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

    const existing = await Attendance.findOne({
      user: req.user.id,
      date: today,
    });

    if (existing) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, `${req.user.id}-${Date.now()}`);

    const attendance = new Attendance({
      user: req.user.id,
      date: today,
      checkInLocation: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      },
      checkInPhoto: cloudinaryUrl,
      checkInTime: new Date(),
    });

    await attendance.save();

    res.status(200).json({
      message: 'Check-in successful',
      checkInPhotoUrl: cloudinaryUrl,
    });
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

    const attendance = await Attendance.findOne({
      user: req.user.id,
      date: today,
    });

    if (!attendance) {
      return res.status(400).json({ error: 'No check-in record found for today' });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({ error: 'Already checked out today' });
    }

    const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, `${req.user.id}-${Date.now()}`);

    attendance.checkOutLocation = {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
    };
    attendance.checkOutPhoto = cloudinaryUrl;
    attendance.checkOutTime = new Date();

    await attendance.save();

    res.status(200).json({
      message: 'Check-out successful',
      checkOutPhotoUrl: cloudinaryUrl,
    });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Server error during check-out' });
  }
});

// ✅ Admin /all route
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

    const formatted = records.map((rec) => {
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
