const { verifyToken }= require('../services/jwtToken.js')
const secret= process.env.Secret
const { redisClient } = require("../services/redisConnection.js")
const Notification= require('../models/notificationForOwner.js')
const TokenPrice= require('../models/messTokenPrice.js')
const crypto = require('crypto')
const Transaction= require('../models/transactionSchema.js')
const PreRegisteredStudent= require('../models/preRegistrationEmailSchema.js')
const User= require('../models/signUpSchema.js')
const UserProfile= require('../models/studentProfile.js')
const Token= require('../models/tokenSchema.js')
const PushNotificationToken= require('../models/pushNotificationToken.js')
const { sendPushNotifications }= require('../services/sendPushNotification.js')
const { notificationFunction }= require('../services/notificationService.js')
const mongoose= require('mongoose')
const { sendEmailPreRegisteredMessage } = require('../services/emailServices.js')
const MessProfile= require('../models/messProfileSchema.js')



exports.handleHelloOwner= async(req,res)=>{
    try{
        console.log(req.user.role)
        return res.status(200).json({ success: true, message: `All The Best ${req.user.role}`})

    }catch(err){
        console.error("Error in Hello Owner API "+ err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error" })
    }
}


exports.handleNotificationForOwner= async(req, res)=>{
    try{
        const mess_id= req.user.mess_id
        if (!mess_id) {
            return res.status(400).json({ success: false, message: 'mess_id is required.' })
        }
        const notifications= await Notification.find({ mess_id })
                                .select('type title message student_username data notificationType createdAt')
                                .sort( { createdAt: -1})
        if(!notifications) {
            return res.status(404).json({ success: false, message: 'no notifications for the user.' })
        }
        
        console.log("notification for owner sent successfully.")
        return res.status(200).json({ success: true, count: notifications.length, data: notifications })

    }catch(err){
        console.error('Error fetching notifications:', err.message)
        return res.status(500).json({ success: false, message: 'Internal Server Error.' })
    }
}


exports.handleGetOwnerTransactionsOfCash= async(req, res)=>{
    try{
        const role= req.user.role
            if( role != 'owner'){
                return res.status(404).json({ success: false, message: 'You are not authorize to access the function.' })
            }
            
        const transactionData= await Transaction.find({ mess_id: req.user.mess_id, transactionBy: req.user.role }).sort({ createdAt: -1 })
            if(!transactionData) {
                return res.status(404).json({ success: false, message: 'No Cash Transaction History found for owner.' })
            }

        console.log("Cash transaction history for owner sent successfully.")
        return res.status(200).json({ success: true, count: transactionData.length, data: transactionData })

    }catch(err){
        console.error('Error fetching cash-transaction data :', err.message)
        return res.status(500).json({ success: false, message: 'Internal Server Error.' })
    }
}


exports.handlePostCreateTokenPrice= async(req, res)=>{
    const session= await mongoose.startSession()
    try{
        const { tokenPrice, duration, name, description, metadata }= req.body
            if (typeof tokenPrice !== "number" || isNaN(tokenPrice) || tokenPrice < 0) {
                return res.status(400).json({ success: false, message: "Invalid token price. Must be a non-negative number." })
            }
          
            if (typeof duration !== "number" || isNaN(duration) || duration <= 0) {
                return res.status(400).json({ success: false, message: "Invalid duration. Must be a positive number." })
            }

            if (typeof name !== "string" || name.trim() === "") {
                return res.status(400).json({ success: false, message: "Token name is required and must be a non-empty string." })
            }

        const generatedId = crypto.randomInt(10000, 100000).toString()

        session.startTransaction()

        const result = await TokenPrice.create([{
            id: generatedId,
            mess_id: req.user.mess_id,
            price: tokenPrice,
            duration,
            name: name.trim(),
            description: description || "N/A",
            metadata: metadata || {},
        }], {session})

        let pushSent
        let type= 'token-configs'
        let notificationType= 'both'
        let title= 'Added a New Token-Configuration'
        let message= `Mess owner added new token-configuration in the Mess. Config Name: ${name} and Price : ${tokenPrice}`
        let data = { id: result[0]._id, name: name.trim(), price: tokenPrice, duration: duration, description: description || "N/A" }

        const ownerTokens= await PushNotificationToken.find({ userId: req.user.id, mess_id: req.user.mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, { title: title, body: message })
                    pushSent= true
                }catch(err){
                    console.error(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }
        
        const result1= await notificationFunction(req.user.mess_id, req.user.id, req.user.username, type, title, message, data, notificationType, pushSent, session )
        
        await session.commitTransaction()
        console.log(`Token Configuration Set for the Config ID: ${result[0]._id}`)

        return res.status(200).json({ success: true, message: `Token Configuration Added.`, data: result })

    }catch(err){
        await session.abortTransaction()
        console.error("Error in Owner set token price function:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error." })

    }finally{
        await session.endSession()
    }
}


exports.handlePostUpdateTokenConfiguration= async(req, res)=>{
    const session= await mongoose.startSession()
    try {
        const { tokenPrice, duration, _id, name, description, metadata } = req.body;

        if (!_id || typeof _id !== "string") {
            return res.status(400).json({ success: false, message: "Missing or invalid token configuration ID (_id)."})
        }

        if (typeof tokenPrice !== "number" || isNaN(tokenPrice) || tokenPrice < 0) {
            return res.status(400).json({ success: false, message: "Invalid token price. Must be a non-negative number."})
        }

        if (typeof duration !== "number" || isNaN(duration) || duration <= 0) {
            return res.status(400).json({ success: false, message: "Invalid duration. Must be a positive number."})
        }

        if (!name || typeof name !== "string" || name.trim() === "") {
            return res.status(400).json({ success: false, message: "Token name is required and must be a non-empty string." })
        }

        session.startTransaction()
        const mess_id= req.user.mess_id 
        const updated = await TokenPrice.findOneAndUpdate(
            { _id, mess_id },
            {
              price: tokenPrice,
              duration,
              name: name.trim(),
              description: description || "",
              metadata: metadata || {},
            },
            { 
                new: true, 
                session
            }
          )
          
        if (!updated) {
            await session.abortTransaction()
            return res.status(404).json({ success: false, message: "Token configuration not found or unauthorized."})
        }
        
        let pushSent
        let type= 'token-configs'
        let notificationType= 'both'
        let title= 'Updated Existing Token-Configuration'
        let message= `Mess owner updated a existing token-configuration in the Mess. Config Name: ${name} and Price : ${tokenPrice}`
        let data = { id: updated._id, name: name.trim(), price: tokenPrice, duration: duration, description: description || "N/A" }

        const ownerTokens= await PushNotificationToken.find({ userId: req.user.id, mess_id: req.user.mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, { title: title, body: message })
                    pushSent= true
                }catch(err){
                    console.error(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }
        
        const result1= await notificationFunction(req.user.mess_id, req.user.id, req.user.username, type, title, message, data, notificationType, pushSent, session )

        await session.commitTransaction()
        console.log(`Token Configuration Updated for the Config ID: ${updated._id}`)

        return res.status(200).json({ success: true, message: "Token Configuration Updated.", data: updated })

      } catch (err) {
        await session.abortTransaction()
        console.error("Error updating token price:", err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error."})

      } finally{
        await session.endSession()
      }
}


exports.handleDeleteTokenConfiguration = async (req, res) => {
  const session= await mongoose.startSession()
  try {
        const { _id } = req.body
        const mess_id  = req.user.mess_id

            if (!_id || typeof _id !== "string") {
                return res.status(400).json({ success: false, message: "Missing or invalid token configuration ID (_id)." })
            }

        session.startTransaction()
        const deleted = await TokenPrice.findOneAndDelete({ _id, mess_id }, { session })
            if (!deleted) {
                return res.status(404).json({ success: false, message: "Token configuration not found or unauthorized."})
            }
        
        let pushSent
        let type= 'token-configs'
        let notificationType= 'both'
        let title= 'Deleted a Token-Configuration'
        let message= `Mess owner Deleted a token-configuration in the Mess. Config Name: ${deleted.name} and Price : ${deleted.price}`
        let data = { id: deleted._id, name: deleted.name.trim(), price: deleted.tokenPrice, duration: deleted.duration, description: deleted.description || "N/A" }

        const ownerTokens= await PushNotificationToken.find({ userId: req.user.id, mess_id: req.user.mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, { title: title, body: message })
                    pushSent= true
                }catch(err){
                    console.error(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }
        
        const result1= await notificationFunction(req.user.mess_id, req.user.id, req.user.username, type, title, message, data, notificationType, pushSent, session )

        await session.commitTransaction()
        console.log("Token configuration deleted.")

        return res.status(200).json({ success: true, message: "Token configuration deleted successfully.", data: deleted })

  }catch (err) {
        await session.abortTransaction()
        console.error("Error deleting token configuration:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error."})

  } finally{
        await session.endSession()
  }
}


exports.handlePostDeleteStudent= async(req, res)=>{
    const session= await mongoose.startSession()
    try{
        const mess_id= req.user.mess_id

        const role= req.user.role
            if( role != 'owner'){
                return res.status(403).json({ success: false, message: 'Not authorize to perform this action.'})
            }
        
        const { student_username }= req.body
            if(!student_username){
                return res.status(404).json({ success: false, message: 'students username is required.'})
            }

        session.startTransaction()
        const student = await User.findOne(
                            { username: student_username, mess_id: mess_id, role: 'student', isActive: true },
                            null,
                            { session }
                        )
            if (!student) {
                await session.abortTransaction()
                return res.status(404).json({ success: false, message: 'Student not found or unauthorized access.' })
            }

        student.isActive = false
        await student.save({ session })

        let pushSent
        let type= 'others'
        let notificationType= 'both'
        let title= 'Student Removed'
        let message= `Mess Owner removed a student with username ${student.username} from the Mess.`
        let data = { id: student._id, username: student.username, email: student.email }

        const ownerTokens= await PushNotificationToken.find({ userId: req.user.id, mess_id: req.user.mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, { title: title, body: message })
                    pushSent= true
                }catch(err){
                    console.error(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }
        
        const result1= await notificationFunction(req.user.mess_id, req.user.id, req.user.username, type, title, message, data, notificationType, pushSent, session )

        await session.commitTransaction()
        console.log('Student Id De-activated successfully.')

        return res.status(200).json({ success: true, message: 'Student Id De-activated successfully.' })

    }catch(err){
        await session.abortTransaction()
        console.error('Error deleting student:', err.message)
        return res.status(500).json({ success: false, message: 'Internal server error.' })

    } finally{
        await session.endSession()
    }
}


exports.handleGetAllMessStudent= async(req, res)=>{
    try{
        const mess_id= req.user.mess_id
        if(!mess_id){
            return res.status(403).json({ success: false, message: 'Student not found or unauthorized access.' });
        }

        const students = await UserProfile.find(
                                    { mess_id: mess_id, role: 'student' },
                                    {
                                    user: 1,
                                    username: 1,
                                    fullName: 1,
                                    bio: 1,
                                    profileImage: 1,
                                    phone: 1,
                                    profession: 1,
                                    age: 1,
                                    dateOfBirth: 1,
                                    createdAt: 1
                                    }
                                )
                                .sort({ createdAt: -1 })
                                .lean()

          console.log('All students profile sent successfully.')
          return res.status(200).json({ success: true, message: 'data sent successfully.', data: students })

    }catch(err){
        console.error('Error sending registered student data:', err.message)
        return res.status(500).json({ success: false, message: 'Internal server error.' })
    }
}


exports.handlePostFullStudentDetail= async(req, res)=>{
    try{
        const { student_id }= req.body
        if( !student_id ){
            return res.status(400).json({ success: false, message: 'Student Id is required' })
        }

        const studentData = await UserProfile.findOne({ user: student_id })
                                    .populate({
                                        path: 'user',
                                        select: 'username email mess_id',
                                        populate: {
                                            path: 'tokens',
                                            select: 'tokenCode issued_by expiryDate redeemed createdAt',
                                            populate: {
                                                path: 'tokenConfigId',
                                                select: 'name price duration description',
                                            }
                                        }
                                    })
                                    .lean()
        if(!studentData){
            return res.status(404).json({ success: false, message: 'No Data present For the student' })
        }

        console.log('All Details sent for the student.')
        return res.status(200).json({ success: true, message: 'data sent successfully.', data: studentData  })

    }catch(err){
        console.error('Error sending student data:', err.message)
        return res.status(500).json({ success: false, message: 'Internal server error.' })
    }
}


exports.handleGetAllIssuedTokensByMess= async(req, res)=>{
    try{
        const mess_id= req.user.mess_id
            if(!mess_id){
                return res.status(403).json({ success: false, message : 'not authorized to access the resource.'})
            }
        const tokens = await Token.find({ mess_id  })
                            .populate({
                                path: 'user',
                                select: 'username mess_id',
                            })
                            .populate({
                                path: 'tokenConfigId',
                                select: 'name price duration',
                            })
                            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: tokens })

    }catch(err){
        console.error("Error in Owner Token Sending function:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error." });
    }
}


exports.handlePostAddStudentsToMess= async(req, res)=>{
    const session= await mongoose.startSession()
    try{
        const { name, email, phone  } = req.body
        const { id: userId, username, mess_id } = req.user || {}

            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ success: false, message: 'Missing or invalid student name.' })
            }
            
            if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
                return res.status(400).json({ success: false, message: 'Missing or invalid email address.' })
            }
            
            if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
                return res.status(400).json({ success: false, message: 'Missing or invalid phone number.' })
            }
            
            if (!mess_id || typeof mess_id !== 'string' || mess_id.trim().length === 0) {
                return res.status(400).json({ success: false, message: 'Missing or invalid mess ID.' })
            }
            
            if (!userId || !username) {
                return res.status(401).json({ success: false, message: 'Unauthorized. Missing user context.' })
            }

        session.startTransaction()

        const existing = await PreRegisteredStudent.findOne({ email: email, mess_id: mess_id }).session(session)
            if (existing) {
                await session.abortTransaction()
                return res.status(409).json({ success: false, message: 'This email is already pre-registered.' })
            }
        
        const student = new PreRegisteredStudent({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            mess_id: mess_id.trim(),
            registeredBy: userId,
            registererUsername: username,
        })
        await student.save({ session })

        let pushSent
        let type= 'others'
        let notificationType= 'both'
        let title= 'Student Added'
        let message= `Mess Owner ${username} Added a student with email: ${ email } to the Mess.`
        let data = { object_id: student._id, student_name: student.name, student_email: student.email, phone: student.phone, mess_id: mess_id, registeredBy: student.registererUsername }

        const ownerTokens= await PushNotificationToken.find({ userId: userId, mess_id: mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, { title: title, body: message })
                    pushSent= true
                }catch(err){
                    console.error(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }
        
        const result1= await notificationFunction(mess_id, userId, username, type, title, message, data, notificationType, pushSent, session )

        await session.commitTransaction()
        
        await sendEmailPreRegisteredMessage(email, mess_id)
        console.log('Student pre-registered successfully.')

        res.status(201).json({ success: true, message: 'Student pre-registered successfully.', data: student })

    }catch(err){
        await session.abortTransaction()
        console.error('Pre-registration error:', err.message)
        return res.status(500).json({ success: false, message: 'Internal server error.' })

    }finally{
        await session.endSession()
    }
}


exports.handleGetMessProfileData= async(req, res)=>{
    try{
        const username= req.user.username
        const mess_id= req.user.mess_id
        const id= req.user.id

        if (!username || !mess_id || !id ) {
            return res.status(400).json({ success: false, message: "Username , id and mess_id are required." })
        }

        const messProfile = await MessProfile.findOne({ ownerId: id, ownerUsername: username, mess_id }).lean()
        if (!messProfile) {
            return res.status(404).json({ success: false, message: "Profile not found." })
        }

        console.log("Mess profile data sent.")
        return res.status(200).json({ success: true, message : 'Mess profile data sent.', data: messProfile })

    }catch(err){
        console.error("Error fetching Mess profile:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error" })
    }
}


exports.handlePostUpdateMessProfile= async(req, res)=>{
    const session = await mongoose.startSession()
    try{
        const id= req.user.id
        const updates= req.body
        const mess_id = req.user.mess_id
        const username = req.user.username

        if ( !username || !mess_id || !id ) {
            return res.status(400).json({ success: false, message: "Required Data is not present" })
        }

        const allowedFields = [
            "messName", "messAddress", "messContactNumber", "messType", "messImage", "description"
        ]

        const updateFields = {}
        for (const key of Object.keys(updates)) {
            if (allowedFields.includes(key)) {
                updateFields[key] = updates[key];
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields provided for update." })
        }

        session.startTransaction()
        const updatedProfile = await MessProfile.findOneAndUpdate(
            { ownerId: id, ownerUsername: username, mess_id },
            { $set: updateFields },
            { new: true, session }
        ).lean()

        if (!updatedProfile) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Mess Profile not found." })
        }

        console.log("Mess Profile Updated Successfully.")
        await session.commitTransaction()
        return res.status(200).json({ success: true, message: "Mess Profile updated successfully.", data: updatedProfile })
        
    }catch(err){
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Error updating mess profile:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error" })

    }finally{
        session.endSession()
    }
} 

exports.handleOwnerLogout= async(req,res)=>{
    try{
        const authHeader= req.headers['authorization']
        let token

        if( authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 7){
            token= authHeader.slice(7).trim()
        }

        if(!token){
            return res.status(401).json({ success: false, message: 'Authentication token is missing.' })
        }

        let user
        try{
            user= await verifyToken(token, secret)
        }catch(err){
            console.error("Token verification failed:", err.message)
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Token has already expired.' })
            }
            return res.status(401).json({ success: false, message: 'Invalid token.' })
        }

        try{
            const expirationTime= user.exp - Math.floor( Date.now() / 1000 )
            if( expirationTime > 0){
                await redisClient.set(token, 'blacklisted', 'EX', expirationTime)
            }
        }catch(err){
            console.error("Error storing token in Redis blacklist:", err.message)
            return res.status(500).json({ success: false, message: "Internal Server Error." })
        }

        console.log("Logged out successfully")
        return res.status(200).json({ success: true, message: `${req.user.role} Logged out successfully.` })

    }catch(err){
        console.error("Error in Owner logout function:", err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error." })
    }
}