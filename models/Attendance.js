const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  checkInLocation: {
    lat: Number,
    lon: Number
  },
  checkOutLocation: {
    lat: Number,
    lon: Number
  },
  checkInPhoto: { type: String },
  checkOutPhoto: { type: String }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
