const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');

// Check-In
router.post('/checkin', auth, async (req, res) => {
    const { lat, lon } = req.body;
    const date = new Date().toISOString().slice(0, 10);

    const existing = await Attendance.findOne({ user: req.user.id, date });
    if (existing && existing.checkInTime)
        return res.status(400).send("Already checked in");

    const attendance = new Attendance({
        user: req.user.id,
        checkInTime: new Date(),
        checkInLocation: { lat, lon },
        date
    });

    await attendance.save();
    res.send("Checked in");
});

// Check-Out
router.post('/checkout', auth, async (req, res) => {
    const { lat, lon } = req.body;
    const date = new Date().toISOString().slice(0, 10);

    const attendance = await Attendance.findOne({ user: req.user.id, date });
    if (!attendance || attendance.checkOutTime)
        return res.status(400).send("Not checked in or already checked out");

    attendance.checkOutTime = new Date();
    attendance.checkOutLocation = { lat, lon };
    await attendance.save();

    res.send("Checked out");
});

// Admin View
// router.get('/all', auth, async (req, res) => {
//     if (req.user.role !== 'admin') return res.status(403).send("Access denied");

//     const data = await Attendance.find().populate('user', 'name email');
//     res.json(data);
// });

//without formatted date
// router.get('/all', auth, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).send("Access denied");

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const { from, to, user } = req.query;
//     const filter = {};

//     // Apply user filter (employee ID)
//     if (user) {
//       filter.user = user;
//     }

//     // Apply date range filter
//     if (from && to) {
//       filter.date = {
//         $gte: from,
//         $lte: to,
//       };
//     } else if (from) {
//       filter.date = { $gte: from };
//     } else if (to) {
//       filter.date = { $lte: to };
//     }

//     const [data, totalRecords] = await Promise.all([
//       Attendance.find(filter)
//         .sort({ checkInTime: -1 })
//         .skip(skip)
//         .limit(limit)
//         .populate('user', 'name email'),
//       Attendance.countDocuments(filter)
//     ]);

//     res.json({
//       data,
//       page,
//       totalPages: Math.ceil(totalRecords / limit),
//       totalRecords
//     });
//   } catch (err) {
//     console.error('Filtered pagination error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });


// GET /api/attendance/all
router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send("Access denied");

  try {
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

    // Format times
    const formatted = records.map((rec) => ({
      _id: rec._id,
      user: rec.user,
      date: rec.date,
      checkInTime: rec.checkInTime
        ? new Date(rec.checkInTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : null,
      checkOutTime: rec.checkOutTime
        ? new Date(rec.checkOutTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : null,
      checkInLocation: rec.checkInLocation,
      checkOutLocation: rec.checkOutLocation,
    }));

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
// This code defines the attendance routes for checking in and out, as well as an admin view to see all attendance records.
// It uses the `auth` middleware to protect the routes and ensure that only authenticated users can