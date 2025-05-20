const mongoose = require('mongoose')

const pushNotificationTokenSchema = new mongoose.Schema({
   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   mess_id: { type: String, required: true },
   token: { type: String, required: true, unique: true },            
   deviceType: { type: String },
   browserInfo: { type: String },
   ipAddress: { type: String },
   lastUpdated: { type: Date, default: Date.now }
 }, { timestamps: true })

const NotificationToken = mongoose.model('notificationToken', pushNotificationTokenSchema)

module.exports = NotificationToken
