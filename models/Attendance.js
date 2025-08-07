const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  checkInTime: Date,
  checkOutTime: Date,
  checkInLocation: {
    lat: Number,
    lon: Number
  },
  checkOutLocation: {
    lat: Number,
    lon: Number
  },
  checkInPhoto: {
    type: String // ✅ stores filename of check-in selfie
  },
  checkOutPhoto: {
    type: String // ✅ stores filename of check-out selfie
  },
  date: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
