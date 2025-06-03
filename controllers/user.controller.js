const path= require('path')
const crypto = require('crypto')
const secret= process.env.Secret
const mongoose= require('mongoose')
const validator = require('validator')
const OTP= require('../models/otpSchema.js') 
const Profile= require('../models/studentProfile.js')
const adminData = require('../models/signUpSchema.js')
const MessProfile= require('../models/messProfileSchema.js')
const PushNotificationToken= require('../models/pushNotificationToken.js')
const PreRegisteredStudent = require('../models/preRegistrationEmailSchema.js')

const { notificationFunction }= require('../services/notificationService.js')
const { sendPushNotifications }= require('../services/sendPushNotification.js')
const { hashPassword, verifyPassword}= require('../services/passwordHashing.js')
const { sendSignUpOTP, sendForgetPassOTP } = require('../services/emailServices.js')
const { createJwtToken, verifyToken, decodeToken }= require('../services/jwtToken.js')

const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)




exports.handleGetHomePage= async( req,res)=>{
    try{
        res.sendFile(path.join(__dirname, '..','public', 'home.html'));
    }catch(err){
        console.error("Error in sending Email for sign-up: " + err.message)
        return res.status(500).json({ success: false, message: "Internal server error." })
    }
}


exports.handleSendEmailForSignUp = async (req, res) => {
    const session= await mongoose.startSession()
    try {
        session.startTransaction()
        const { username, password, confirmPassword, email, role, mess_id } = req.body

        if (!username || !password || !confirmPassword || !email || !role || !mess_id) {
            await session.abortTransaction()
            return res.status(400).json({ success: false, message: "All fields are required." })
        }

        if (!validator.isEmail(email)) {
            await session.abortTransaction()
            return res.status(400).json({ success: false, message: "Invalid email format." })
        }

        if (password !== confirmPassword) {
            await session.abortTransaction()
            return res.status(400).json({ success: false, message: "Passwords do not match." })
        }

        if(role === 'student'){
            const preRegistered = await PreRegisteredStudent.findOne({ email: email.toLowerCase().trim(), mess_id: mess_id, isRegistered: false }).session(session)
            if (!preRegistered) {
                await session.abortTransaction()
                return res.status(403).json({ success: false, message: "Email not pre-registered. Contact the mess owner." })
            }
        }

        const existingUser = await adminData.findOne({ 
            $or: [{ email, mess_id }, { username, mess_id }]
        }).session(session)
         
        if (existingUser) {
            await session.abortTransaction()
            return res.status(400).json({ success: false, message: "This email or username is already registered in this mess." })
        }

        const hashedPassword = await hashPassword(password)

        try{
            await adminData.create([{
                username: username,
                email: email,
                password: hashedPassword,
                role: role,
                isActive: false,
                mess_id : mess_id
            }], { session })
            
        }catch(err){
            console.error("Error in user data submission: "+ err.message)
            throw err
        }
        
        const otp = crypto.randomInt(100000, 999999).toString()

        try{
             await OTP.create([{
                email: email,
                mess_id: mess_id,
                otp: otp,
                createdAt: new Date(), 
            }], { session })
            
        }catch(err){
            console.error("Error in OTP Storing: "+ err.message)
            throw err
        }

        await sendSignUpOTP(email, otp)
        console.log(`OTP sent successfully for User Sign-Up.`);
        
        await session.commitTransaction()

        return res.status(200).json({ success: true, message: `OTP sent successfully to ${email}`, email: email, mess_id: mess_id })

    } catch (err) {
        if (session && session.inTransaction()) {
            await session.abortTransaction()
        }
        console.error("Error in sending Email for sign-up: " + err.message)
        return res.status(500).json({ success: false, message: "Internal server error." })

    } finally{
        await session.endSession()
    }
}


exports.handlePostVerifyOTP = async (req, res) => {
    const session= await mongoose.startSession()
    let { email, mess_id, otp } = req.body
    otp= Number(otp)

    try {
        session.startTransaction()

        if ( !email || !otp || !mess_id ) {
            await session.abortTransaction()
            return res.status(400).json({ success: false, message: "All fields are required." })
        }
        
        if (!validator.isEmail(email)) {
            await session.abortTransaction()
            return res.status(400).json({ success: false, message: "Invalid email format" })
        }

        const otpDoc = await OTP.findOne({ email, mess_id })

        if (!otpDoc) {
            const inactiveUser = await adminData.findOne({ email, mess_id, isActive: false })
            if (inactiveUser) {
                await adminData.deleteOne({ email, mess_id, isActive: false })
            }
            await session.abortTransaction()
            return res.status(400).json({ message: 'OTP Expired.Sign-up again.' })
        }

        if (otpDoc.otp !== otp) {
            await session.abortTransaction()
            return res.status(400).json({ message: `Invalid OTP.` })
        }

        try{
            const updatedAdmin = await adminData.findOneAndUpdate(
                { email, mess_id },
                { $set: { isActive: true } },
                { new: true, session }
              )
            
            await OTP.deleteOne({ email, mess_id }).session(session)

            await Profile.create([{
                user: updatedAdmin._id, 
                username: updatedAdmin.username,
                email: email,
                role: updatedAdmin.role,
                isActive: true, 
                mess_id: mess_id,
            }], { session })

            const role= updatedAdmin.role
                if(role === 'student'){
                    await PreRegisteredStudent.findOneAndUpdate(
                        { email, mess_id },
                        { $set: { isRegistered: true } },
                        { new: true, session }
                    )

                    let pushSent= false
                    let type= 'security'
                    let notificationType= 'in-app'
                    let title= 'Account Created'
                    let message= `User Account created successfully with username : ${updatedAdmin.username}.`
                    let data = { username: updatedAdmin.username, email: email, mess_id: mess_id }
        
                    const result1= await notificationFunction(mess_id, updatedAdmin._id, updatedAdmin.username, type, title, message, data, notificationType, pushSent, session )

                }else if(role === 'owner'){
                    await MessProfile.create([{
                        ownerId: updatedAdmin._id,
                        ownerUsername: updatedAdmin.username,
                        mess_id: mess_id,
                        email: email
                    }], { session })

                    let pushSent= false
                    let type= 'security'
                    let notificationType= 'in-app'
                    let title= 'Account Created'
                    let message= `Mess Owner Account created successfully with username : ${updatedAdmin.username}.`
                    let data = { username: updatedAdmin.username, email: email, mess_id: mess_id }
        
                    const result1= await notificationFunction(mess_id, updatedAdmin._id, updatedAdmin.username, type, title, message, data, notificationType, pushSent, session )
                }
            
        }catch(err){
            throw err
        }

        await session.commitTransaction()
        console.info('OTP verified. Registration complete')

        return res.status(200).json({ success: true, message: 'OTP verified. Registration complete.' })

    } catch (err) {
        await session.abortTransaction()
        console.error('Error verifying OTP.'+ err.message)
        return res.status(500).json({ success: false, message: 'Error verifying OTP.' })
        
    } finally {
        await session.endSession()
    }
}


exports.handlePostUserLogin= async (req, res)=>{
    try{
        const {username, password }= req.body
    
        let { role, mess_id }= req.body
              if( !username || !password || !role || !mess_id)  { 
                 return res.status(400).json({ success: false, message: "All Fields are required."})
              }

        const user= await adminData.findOne( {username: username, mess_id: mess_id, isActive: true, role: role})
             if( !user){
                const dummyHash= "$argon2d$v=19$m=12,t=3,p=1$ajUydGFhaWw4ZTAwMDAwMA$MRhztKGcPpp8tyzeH9LvDQ"
                await verifyPassword( dummyHash, password)
                return res.status(400).json({ success: false, message: "Incorrect username or password"})
             }
     
        let match
        try{
            match= await verifyPassword(user.password, password)
        }catch(err){
            console.error(err.message)
            throw err
        }

        if(!match){
            return res.status(400).json({ success: false, message: "Incorrect username or password"})
        }

        const id= user._id
        role= user.role
        mess_id= user.mess_id
        const session_id= await createJwtToken( username, id, role, mess_id, secret)
        
        console.log(`${role} logged in.`)
        
        return res.status(200).json({ success: true, message:"log in successfull", token: session_id})
        
    }catch(err){
        console.error("Error in user login API: ", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error."})
    }
}


exports.handlePostSendPasswordResetOTP= async(req, res)=>{
    try{
        const { email, username, mess_id, role }= req.body
        if (!username || !email || !mess_id || !role ) {
            return res.status(400).json({ success: false, message: "Username, email, mess id and role are required." });
        }
        
        const user= await adminData.findOne({ email, username, mess_id, role})
        if (!user) {
            return res.status(400).json({ success: false, message: "No user found with the provided data." });
        }

        const otp = crypto.randomInt(100000, 999999).toString()

        await OTP.create([{
            email: email,
            mess_id: mess_id,
            otp: otp,
            createdAt: new Date(), 
        }])

        await sendForgetPassOTP(email, otp)
        console.log("OTP Sent for Password reset.")
        return res.status(200).json({ success: true, message: "OTP sent successfully for password reset.", email: user.email })

    }catch(err){
        console.error("Error in sending email for pass. reset API: ", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error."})
    }
}


exports.handlePostGoogleAuth= async(req, res)=>{
    const { idToken, mess_id, role } = req.body

    if (!idToken || !mess_id || !role) {
        return res.status(400).json({ success: false, message: "Missing fields" })
    }

    let payload
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        })
        payload = ticket.getPayload()
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid Google token" })
    }

    const { email, name } = payload

    let username
    const session= await mongoose.startSession()
    try {
        session.startTransaction()

        let user = await adminData.findOne({ email, mess_id, role }).session(session)
            if (!user) {
                const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
                const suffix = Math.floor(1000 + Math.random() * 9000)
                username= `${base}${suffix}`

                user = await adminData.create([{
                    email,
                    username,
                    mess_id,
                    role,
                    isActive: true,
                    password: '1234567890'
                }], { session })

                await Profile.create([{
                    user: user[0]._id,
                    username,
                    email,
                    mess_id,
                    isActive: true,
                    role
                }], { session })

                await MessProfile.create([{
                    ownerId: user[0]._id,
                    ownerUsername: username,
                    mess_id: mess_id,
                    email: email
                }], { session })

                let pushSent= false
                let type= 'security'
                let notificationType= 'in-app'
                let title= 'Account Created'
                let message= `Mess Owner Account created successfully with username : ${user[0].username}.`
                let data = { username: user[0].username, email: email, mess_id: mess_id }

                const result1= await notificationFunction(mess_id, user[0]._id, user[0].username, type, title, message, data, notificationType, pushSent, session )

                await session.commitTransaction()
                console.log('Google Account Creation and login successful')
                const token = await createJwtToken(user[0].username, user[0]._id, role, mess_id, secret)

                return res.status(200).json({ success: true, message: "Google Account Creation and login successful", token: token })

            }else{
                await session.commitTransaction()
                console.log('Google login successful')
                const token = await createJwtToken(user.username, user._id, role, mess_id, secret)

                return res.status(200).json({ success: true, message: "Google login successful", token: token })
            }

    } catch (err) {
        await session.abortTransaction()
        console.error("Google login error:", err.message)
        return res.status(500).json({ success: false, message: "Server error" })

    } finally{
        await session.endSession()
    }
}
