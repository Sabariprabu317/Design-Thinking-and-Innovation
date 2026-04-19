const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  teacherName: { type: String, required: true },
  dept:        { type: String, required: true },
  className:   { type: String, required: true },
  subject:     { type: String, required: true },
  content:     { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
