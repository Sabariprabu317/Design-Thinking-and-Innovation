const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  rollNo:      { type: String, required: true },
  studentName: { type: String, required: true },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  dept:        { type: String, required: true },
  className:   { type: String, required: true },
  subject:     { type: String, required: true },
  examType:    { type: String, required: true },
  maxMarks:    { type: Number, required: true },
  scored:      { type: Number, required: true },
  grade:       { type: String },
  remarks:     { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Mark', markSchema);
