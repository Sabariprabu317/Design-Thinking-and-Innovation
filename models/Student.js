const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  rollNo:     { type: String, required: true, unique: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  dept:       { type: String, required: true },
  className:  { type: String, required: true },
  profilePic: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);