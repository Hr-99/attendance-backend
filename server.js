const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { startAttendanceCleanupJob } = require('./scheduler');


require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// startAttendanceCleanupJob(); works in scheduler.js for server taht keeps running




mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/uploads', express.static('uploads')); // For serving images


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
