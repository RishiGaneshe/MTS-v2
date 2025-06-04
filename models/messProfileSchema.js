const mongoose = require('mongoose');

const messProfileSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerUsername: { type: String, required: true},
    mess_id: { type: String, default: null },
    email:   { type: String, required: true },
    messName: { type: String, default: null },
    messAddress: { type: String, default: null },
    messContactNumber: { type: String, default: null },
    messType: { type: String, enum: ['Veg', 'Non-Veg', 'Both'], default: null },
    messImage: { type: String, default: null },
    description: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const MessProfile = mongoose.model('MessProfile', messProfileSchema)

module.exports = MessProfile
