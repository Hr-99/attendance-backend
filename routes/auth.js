const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');


// Register (for testing purpose)
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed, role });
        await user.save();
        res.send("User registered");
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send("User not found");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send("Invalid password");

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
});




router.get('/all', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send("Access denied");
  const users = await User.find({ role: { $ne: 'admin' } }, '_id name email role');
  res.json(users);
});



// Register new user (Admin only should use this)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).send('All fields are required');
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).send('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'employee',
    });

    await user.save();
    res.status(201).send('User registered successfully');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
