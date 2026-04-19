const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const auth = require('../middleware/auth');

// Seed admin via GET (browser friendly)
router.get('/seed', async (req, res) => {
  try {
    const exists = await Admin.findOne({ username: 'admin' });
    if (exists) return res.json({ message: 'Admin already exists' });
    const hashed = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashed });
    res.json({ message: '✅ Admin created: admin / admin123' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Seed admin via POST
router.post('/seed', async (req, res) => {
  try {
    const exists = await Admin.findOne({ username: 'admin' });
    if (exists) return res.json({ message: 'Admin already exists' });
    const hashed = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashed });
    res.json({ message: '✅ Admin created: admin / admin123' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, role: 'admin' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add teacher
router.post('/add-teacher', auth, async (req, res) => {
  try {
    const { name, email, password, dept, subjects } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({ name, email, password: hashed, dept, subjects });
    res.json({ message: '✅ Teacher added', teacher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add student
router.post('/add-student', auth, async (req, res) => {
  try {
    const { name, rollNo, email, password, dept, className } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const student = await Student.create({ name, rollNo, email, password: hashed, dept, className });
    res.json({ message: '✅ Student added', student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all teachers
router.get('/teachers', auth, async (req, res) => {
  try {
    const teachers = await Teacher.find().select('-password');
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all students
router.get('/students', auth, async (req, res) => {
  try {
    const students = await Student.find().select('-password');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete teacher
router.delete('/teacher/:id', auth, async (req, res) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Teacher deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete student
router.delete('/student/:id', auth, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Student deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;