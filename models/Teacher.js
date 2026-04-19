const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  dept:       { type: String, required: true },
  subjects:   { 
    type: [{ subjectName: String, className: String }], 
    default: [] 
  },
  profilePic: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);