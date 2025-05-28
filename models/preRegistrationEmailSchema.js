const mongoose = require('mongoose');

const preRegisteredStudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  mess_id: { type: String, required: true  },
  isRegistered: { type: Boolean, default: false },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
  registererUsername:{ type: String, required: true},
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('PreRegisteredStudent', preRegisteredStudentSchema)
