const mongoose = require('mongoose')

const SubAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayAccountId: { type: String, required: true, unique: true },
  referenceId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  contact: { type: String, required: true },
  businessName: { type: String, required: true },
  accountHolderName: { type: String, required: true },
  ifsc: { type: String, required: true },
  accountNumber: { type: String, required: true },
  status: { type: String, enum: ['created', 'activated', 'rejected', 'needs_clarification'], default: 'created' },
  notes: { type: Object },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('LinkedAccount', SubAccountSchema)
