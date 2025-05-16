const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    username: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true, enum: ['owner', 'student'] },
    isActive: { type: Boolean, default: true },
    mess_id: { type: String, required: true },    // to be indexed
    fullName: { type: String, default: null },
    bio: { type: String, default: null },
    profileImage: { type: String, default: "https://static.vecteezy.com/system/resources/previews/004/607/791/non_2x/man-face-emotive-icon-smiling-male-character-in-blue-shirt-flat-illustration-isolated-on-white-happy-human-psychological-portrait-positive-emotions-user-avatar-for-app-web-design-vector.jpg" },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    profession: { type: String, default: null },
    age: { type: Number, default: null },
    dateOfBirth: { type: Date, default: null },
  },
  { timestamps: true }
);

const UserProfile = mongoose.model('UserProfile', userProfileSchema)

module.exports = UserProfile;
