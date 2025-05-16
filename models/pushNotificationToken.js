const mongoose = require('mongoose');

const notificationTokenSchema = mongoose.Schema({
   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
   token: { type: String, required: true },
   deviceType: { type: String, required: true, enum: ["web", "android", "ios"], default: "web" },
   browserInfo: { type: String, default: "unknown" },
   ipAddress: { type: String, default: "0.0.0.0" },
   issuedAt: { type: Date, default: Date.now }
}, { timestamps: true })

const NotificationToken = mongoose.model('notificationToken', notificationTokenSchema)

module.exports = NotificationToken
