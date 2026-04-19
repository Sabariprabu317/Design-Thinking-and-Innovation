const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ DB Error:', err));

// Load teacher router first
const teacherRouter = require('./routes/teacher');
const studentRouter = require('./routes/student');
const adminRouter  = require('./routes/admin');

// Routes
app.use('/api/admin',   adminRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/student', studentRouter);

// Test route to check active QRs
app.get('/api/debug/qrs', (req, res) => {
  const activeQRs = require('./utils/qrStore');
  res.json({
    count: Object.keys(activeQRs).length,
    tokens: Object.keys(activeQRs),
    qrs: activeQRs
  });
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
});