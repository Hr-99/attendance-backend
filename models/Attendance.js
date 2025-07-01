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
    date: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
