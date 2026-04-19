const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  rollNo:      { type: String, required: true },
  studentName: { type: String, required: true },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  subject:     { type: String, required: true },
  className:   { type: String, required: true },
  dept:        { type: String, required: true },
  date:        { type: String, required: true },
  time:        { type: String, required: true },
  method:      { type: String, enum: ['qr', 'manual'], default: 'qr' },
  status:      { type: String, enum: ['present', 'absent'], default: 'present' }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);