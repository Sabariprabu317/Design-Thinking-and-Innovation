const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Activity = require('../models/Activity');
const Mark = require('../models/Mark');
const auth = require('../middleware/auth');

// ✅ SHARED MEMORY — module level so it persists
const activeQRs = require('../utils/qrStore');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ✅ Export getter — must be at module level
router.getActiveQRs = () => activeQRs;

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { email, dept, password } = req.body;
    const teacher = await Teacher.findOne({ email, dept });
    if (!teacher) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, teacher.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: teacher._id, role: 'teacher' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      role: 'teacher',
      teacher: { ...teacher._doc, password: undefined }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PROFILE ───
router.get('/profile', auth, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).select('-password');
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PROFILE PIC ───
router.post('/profile-pic', auth, upload.single('pic'), async (req, res) => {
  try {
    await Teacher.findByIdAndUpdate(req.user.id, { profilePic: req.file.filename });
    res.json({ message: '✅ Profile pic updated', filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GENERATE QR ───
router.post('/generate-qr', auth, async (req, res) => {
  try {
    const { subject, className, dept } = req.body;

    if (!subject || !className || !dept) {
      return res.status(400).json({ message: 'Subject, class and dept required' });
    }

    // Generate unique token
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 30000; // 30 seconds

    // Store in memory
    activeQRs[token] = {
      token,
      subject,
      className,
      dept,
      teacherId: req.user.id,
      expiresAt
    };

    console.log('✅ QR Generated:', token);
    console.log('Active QRs now:', Object.keys(activeQRs));

    // Auto delete after 30s
    setTimeout(() => {
      delete activeQRs[token];
      console.log('🗑️ QR expired and deleted:', token);
    }, 30000);

    res.json({ token, expiresAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET STUDENTS ───
router.get('/students', auth, async (req, res) => {
  try {
    const { className, dept } = req.query;
    const students = await Student.find({ className, dept })
      .select('-password')
      .sort({ rollNo: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── VIEW ATTENDANCE ───
router.get('/attendance', auth, async (req, res) => {
  try {
    const { subject, className } = req.query;
    const records = await Attendance.find({
      teacherId: req.user.id, subject, className
    }).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── MANUAL ATTENDANCE ───
router.post('/manual-attendance', auth, async (req, res) => {
  try {
    const { rollNo, subject, className, dept, status } = req.body;
    const student = await Student.findOne({ rollNo });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const now = new Date();
    const today = now.toLocaleDateString('en-IN');

    const existing = await Attendance.findOne({
      studentId: student._id, subject, className, date: today
    });

    if (existing) {
      existing.status = status;
      existing.method = 'manual';
      await existing.save();
      return res.json({ message: '✅ Attendance updated' });
    }

    await Attendance.create({
      studentId: student._id,
      rollNo: student.rollNo,
      studentName: student.name,
      teacherId: req.user.id,
      subject, className, dept,
      date: today,
      time: now.toLocaleTimeString('en-IN'),
      method: 'manual',
      status
    });

    res.json({ message: '✅ Attendance marked manually' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST ACTIVITY ───
router.post('/activity', auth, async (req, res) => {
  try {
    const { dept, className, subject, content } = req.body;
    const teacher = await Teacher.findById(req.user.id);

    await Activity.create({
      teacherId: req.user.id,
      teacherName: teacher.name,
      dept, className, subject, content
    });

    res.json({ message: '✅ Activity posted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET ACTIVITIES ───
router.get('/activities', auth, async (req, res) => {
  try {
    const { className } = req.query;
    const acts = await Activity.find({
      teacherId: req.user.id, className
    }).sort({ createdAt: -1 });
    res.json(acts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ADD MARKS ───
router.post('/marks', auth, async (req, res) => {
  try {
    const { rollNo, subject, className, dept, examType, maxMarks, scored, remarks } = req.body;
    const student = await Student.findOne({ rollNo });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const pct = (scored / maxMarks) * 100;
    const grade =
      pct >= 90 ? 'O' :
      pct >= 80 ? 'A+' :
      pct >= 70 ? 'A' :
      pct >= 60 ? 'B+' :
      pct >= 50 ? 'B' :
      pct >= 40 ? 'C' : 'F';

    const existing = await Mark.findOne({
      studentId: student._id, subject, examType
    });

    if (existing) {
      existing.scored = scored;
      existing.maxMarks = maxMarks;
      existing.grade = grade;
      existing.remarks = remarks;
      await existing.save();
      return res.json({ message: '✅ Marks updated', grade });
    }

    await Mark.create({
      studentId: student._id,
      rollNo: student.rollNo,
      studentName: student.name,
      teacherId: req.user.id,
      dept, className, subject,
      examType, maxMarks, scored,
      grade, remarks
    });

    res.json({ message: '✅ Marks added', grade });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET MARKS ───
router.get('/marks', auth, async (req, res) => {
  try {
    const { subject, className } = req.query;
    const marks = await Mark.find({
      teacherId: req.user.id, subject, className
    }).sort({ rollNo: 1 });
    res.json(marks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;