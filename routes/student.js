const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Activity = require('../models/Activity');
const Mark = require('../models/Mark');
const auth = require('../middleware/auth');

// ✅ Shared QR store
const activeQRs = require('../utils/qrStore');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ email });
    if (!student) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, student.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, role: 'student', student: { ...student._doc, password: undefined } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PROFILE ───
router.get('/profile', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PROFILE PIC ───
router.post('/profile-pic', auth, upload.single('pic'), async (req, res) => {
  try {
    await Student.findByIdAndUpdate(req.user.id, { profilePic: req.file.filename });
    res.json({ message: '✅ Profile pic updated', filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── SCAN QR ───
router.post('/scan-qr', auth, async (req, res) => {
  try {
    const { token } = req.body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 SCAN REQUEST RECEIVED');
    console.log('Token from QR:', token);
    console.log('Total active QRs:', Object.keys(activeQRs).length);
    console.log('Active tokens:', Object.keys(activeQRs));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!token) {
      return res.status(400).json({ message: '❌ No QR token received' });
    }

    const qr = activeQRs[token];

    if (!qr) {
      console.log('❌ Token NOT found in activeQRs');
      return res.status(400).json({ message: '⛔ QR expired or invalid. Ask teacher to regenerate.' });
    }

    console.log('✅ QR Found:', qr);

    if (Date.now() > qr.expiresAt) {
      delete activeQRs[token];
      console.log('❌ QR expired by time');
      return res.status(400).json({ message: '⛔ QR expired. Ask teacher to regenerate.' });
    }

    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: '❌ Student not found' });
    }

    console.log('Student:', student.name);
    console.log('Student class:', student.className, '| QR class:', qr.className);
    console.log('Student dept:', student.dept, '| QR dept:', qr.dept);

    // ✅ Case-insensitive comparison to avoid mismatch
    const classMatch = student.className.trim().toLowerCase() === qr.className.trim().toLowerCase();
    const deptMatch = student.dept.trim().toLowerCase() === qr.dept.trim().toLowerCase();

    if (!classMatch || !deptMatch) {
      console.log('❌ Class/Dept mismatch');
      return res.status(403).json({
        message: `🚫 Wrong class QR! Your class: ${student.className}, QR class: ${qr.className}`
      });
    }

    const now = new Date();
    const rawToday = now.toLocaleDateString('en-IN');
    const dp = rawToday.split('/');
    const today = parseInt(dp[0]) + '/' + parseInt(dp[1]) + '/' + dp[2];

    const existing = await Attendance.findOne({
      studentId: student._id,
      subject: qr.subject,
      className: qr.className,
      date: today
    });

    if (existing) {
      console.log('⚠️ Already marked today');
      return res.status(400).json({ message: '⚠️ Attendance already marked today for ' + qr.subject });
    }

    await Attendance.create({
      studentId: student._id,
      rollNo: student.rollNo,
      studentName: student.name,
      teacherId: qr.teacherId,
      subject: qr.subject,
      className: qr.className,
      dept: qr.dept,
      date: today,
      time: now.toLocaleTimeString('en-IN'),
      method: 'qr',
      status: 'present'
    });

    console.log('✅✅✅ ATTENDANCE MARKED for', student.name, '-', qr.subject);

    res.json({
      message: '✅ Attendance marked!',
      subject: qr.subject,
      className: qr.className,
      time: now.toLocaleTimeString('en-IN')
    });

  } catch (err) {
    console.error('❌ Scan error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── ATTENDANCE HISTORY ───
router.get('/attendance', auth, async (req, res) => {
  try {
    const { subject } = req.query;
    const query = { studentId: req.user.id };
    if (subject) query.subject = subject;
    const records = await Attendance.find(query).sort({ createdAt: -1 });
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const percentage = total ? Math.round((present / total) * 100) : 0;
    res.json({ records, percentage, present, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ACTIVITIES ───
router.get('/activities', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    const { subject } = req.query;
    const query = { className: student.className, dept: student.dept };
    if (subject) query.subject = subject;
    const acts = await Activity.find(query).sort({ createdAt: -1 });
    res.json(acts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── MARKS ───
router.get('/marks', auth, async (req, res) => {
  try {
    const { subject } = req.query;
    const query = { studentId: req.user.id };
    if (subject) query.subject = subject;
    const marks = await Mark.find(query).sort({ createdAt: -1 });
    res.json(marks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;