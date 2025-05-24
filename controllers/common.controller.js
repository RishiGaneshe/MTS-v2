const { createRazorpayInstance }= require('../services/rezorpayIntegration.js')
const { getPaymentDetails, handleGetPaymentInfo }= require('../services/miscellaneousServices.js')
const Token= require('../models/tokenSchema.js')
const crypto= require('crypto')
const User= require('../models/signUpSchema.js')
const SubAccount= require('../models/o_subAccountsData.schema.js')
const mongoose= require('mongoose')
const Transaction= require('../models/transactionSchema.js')
const Notification= require('../models/notificationForOwner.js')
const PushNotificationToken= require('../models/pushNotificationToken.js')
const { sendPushNotifications }= require('../services/sendPushNotification.js')
const TokenPrice= require('../models/messTokenPrice.js')



let RazorpayInstance
const RzInstance= async()=>{
    try{
        RazorpayInstance= await createRazorpayInstance()
    }catch(err){
        console.error("Error in creating Rz Instance"+ err.message)
    }   
}
RzInstance()



exports.handleRazorpayCreateOrder= async (req,res)=>{
    try{
        const tokenData= await TokenPrice.findOne({ mess_id: req.user.mess_id})
            if( !tokenData){
                return res.status(409).json({ success: false, message: "Token Price is not set." })
            }

        let { tokenCount }= req.body
        console.log("Tokens: ", tokenCount)

        tokenCount= tokenCount* tokenData.price;
        console.log("Amount: "+ tokenCount)

        const options= {
                amount: tokenCount*100,
                currency: "INR"
        }

        let order
        try{
            order= await RazorpayInstance.orders.create(options)
            if(!order){
                return res.status(500).json({ success: false, message: "Unable to create order. Try again later.", error: "Internal Server Error"})
            }
        }catch(err){
            console.error("Unable to create order."+ err.message)
            return res.status(500).json({ success: false, message: "Unable to create order. Try again later.", error: "Internal Server Error"})
        }

        console.log("Order Created Successfully.")
        return res.status(200).json({success: true, order:order, message: "Order Sent Successfully" })

    }catch(err){
        console.error("error in Payment order creation API", err.message)
        return res.status(500).json({ success: false, message: "Unable to create order.Try again later.", error: "Internal Server Error"})
    }
}


exports.handleVerifyPayments= async (req,res)=>{
    const session= await mongoose.startSession()
    try{
        session.startTransaction()

        const secret= process.env.RazorPay_Secret
        const { order_id, payment_id, signature }= req.body

            if ( !order_id || !payment_id || !signature ) {
                await session.abortTransaction()
                return res.status(400).json({ success: false, message: "Missing required parameters." })
            }

        const hmac= crypto.createHmac("sha256", secret)
        hmac.update(order_id+ '|' + payment_id)
        const generatedSignature= hmac.digest("hex")

            if(generatedSignature !== signature){
                await session.abortTransaction()
                return res.status(400).json({success: false, message: "Payment failed. Signature Does not matched."})
            }

        const user= await User.findById(req.user.id).session(session)
            if(!user){
                await session.abortTransaction()
                return res.status(401).json({ success: false, message: 'Invalid Request.User Id not Found.' })
            }

        let paymentData
        try{
            paymentData= await handleGetPaymentInfo(payment_id, process.env.RazorPay_key , process.env.RazorPay_Secret )
        }catch(err){
            console.log("Error in the Paymant data info function: ", err.message)
            throw err
        }

        const amount= paymentData.amount / 100
            if (!amount || amount <= 0) {
                await session.abortTransaction()
                return res.status(400).json({ success: false, message: "Invalid payment amount." })
            }

        const tokenData= await TokenPrice.findOne({ mess_id: req.user.mess_id})
            if( !tokenData){
                await session.abortTransaction()
                return res.status(409).json({ success: false, message: "Token Price is not set." })
            }

        const tokenCount = Math.floor(amount / tokenData.price)
            if (tokenCount <= 0) {
                await session.abortTransaction()
                return res.status(400).json({ success: false, message: "Insufficient amount for token purchase." })
            }
        
        const tokens= []

        for(let i=0; i<tokenCount; i++){
            tokens.push ({
                tokenCode: crypto.randomBytes(8).toString('hex'),
                user: req.user.id,
                mess_id: req.user.mess_id,
                issued_by: req.user.username,
                issuer_role: req.user.role,
                expiryDate: new Date(Date.now() + tokenData.duration * 24 * 60 * 60 * 1000),
                redeemed: false,
                amount: tokenData.price,
                transactionId: payment_id
            })
        }
        
        try{        
            const transaction = new Transaction({
                transaction_id: paymentData.id,
                order_id: paymentData.order_id,
                user_id: user._id,
                mess_id: req.user.mess_id,
                username: user.username,
                amount: amount,
                currency: paymentData.currency,
                status: paymentData.status,
                payment_method: paymentData.method,
                tokens_purchased: tokenCount,
                token_validity: new Date(Date.now() + tokenData.duration * 24 * 60 * 60 * 1000),
                razorpay_signature: signature
            })
            await transaction.save()

        }catch(err){
             await session.abortTransaction()
             console.error("Error in Token Issue API", err.message)
             return res.status(500).json({ success: false, error: "Internal Server Error", message: "Error in issueing tokens.Try again later."})
        }

        let insertedMany
        try{
            insertedMany= await Token.insertMany(tokens, { session })
            user.tokens.push(...insertedMany.map(token => token._id))
            await user.save({ session })

        }catch(err){
             await session.abortTransaction()
             console.error("Error in Token Issue API", err.message)
             return res.status(500).json({ success: false, error: "Internal Server Error", message: "Error in issueing tokens.Try again later."})
        }

        const titleForOwner= "Token Purchased"
        const bodyForOwner= `${req.user.username} has purchased ${tokenCount} tokens.`

        const owner= await User.findOne({ mess_id: req.user.mess_id, role: 'owner'})
            if (!owner) {
                console.log("Owner not found.")
            }

        let pushSent= false

        const ownerTokens= await PushNotificationToken.find({ userId: owner._id, mess_id: owner.mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, {
                        title: titleForOwner,
                        body: bodyForOwner
                    })
                    pushSent= true
                }catch(err){
                    console.log(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }

        const titleForStudent= "Token Purchased"
        const bodyForStudent= `You Purchased ${tokenCount} tokens.`

        const studentTokens= await PushNotificationToken.find({ userId: req.user.id, mess_id: req.user.mess_id })
            if (studentTokens.length) {
                const studentTokensArray = studentTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(studentTokensArray, {
                        title: titleForStudent,
                        body: bodyForStudent
                    })
                    pushSent= true
                }catch(err){
                    console.log(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Student.")
            }

        try{
            await Notification.create([{
                mess_id: req.user.mess_id,         
                student: user._id,
                student_username: user.username,   
                type: "transaction",
                title: "Token Purchased",
                message: `${user.username} has purchased ${tokenCount} tokens.`,
                data: { tokenCount: tokenCount },
                notificationType: "both",
                pushSent: pushSent,
                pushResponse: null
            }], { session })

        }catch(err){
            await session.abortTransaction()
            console.error("Error in Token Issue API", err.message)
            return res.status(500).json({ success: false, error: "Internal Server Error", message: "Error in issueing tokens.Try again later."})
        }
  
        await session.commitTransaction()
        console.log("Token Issued Successfully.")
        return res.status(200).json({ success: true, message: ` ${tokenCount} Token Purchased.` })

    }catch(err){
        await session.abortTransaction()
        console.error("Error in payment varification API.",err.message)
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Internal Server Error.Try again later."})

    } finally {
        await session.endSession()
    }
}


exports.handleVerifyPaymentsDoneByOwners= async (req,res)=>{
    const session= await mongoose.startSession()
    try{
        session.startTransaction()
        const mess_id= req.user.mess_id
        const { student_username }= req.body
            if( !student_username ){
                await session.abortTransaction()
                return res.status(400).json({success: false, message: "No username provided."})
            }
        
        const secret= process.env.RazorPay_Secret
        const { order_id, payment_id, signature }= req.body
            if ( !order_id || !payment_id || !signature ) {
                await session.abortTransaction()
                return res.status(400).json({ success: false, message: "Missing required parameters." })
            }

        const hmac= crypto.createHmac("sha256", secret)
        hmac.update(order_id+ '|' + payment_id)
        const generatedSignature= hmac.digest("hex")

            if(generatedSignature !== signature){
                await session.abortTransaction()
                return res.status(400).json({success: false, message: "Payment failed. Signature Does not matched."})
            }

        const user= await User.findOne({ username: student_username, mess_id: mess_id, isActive: true})
            if(!user){
                await session.abortTransaction()
                return res.status(401).json({ success: false, message: 'Invalid Request.User Id not Found.' })
            }

        let paymentData
        try{
            paymentData= await handleGetPaymentInfo(payment_id, process.env.RazorPay_key , process.env.RazorPay_Secret )
        }catch(err){
            console.log("Error in the Paymant data info function: ", err.message)
            throw err
        }

        const amount= paymentData.amount / 100
            if (!amount || amount <= 0) {
                await session.abortTransaction()
                return res.status(400).json({ success: false, message: "Invalid payment amount." })
            }

        const tokenData= await TokenPrice.findOne({ mess_id: req.user.mess_id})
            if( !tokenData){
                await session.abortTransaction()
                return res.status(409).json({ success: false, message: "Token Price is not set." })
            }

        const tokenCount = Math.floor(amount / tokenData.price)
            if (tokenCount <= 0) {
                await session.abortTransaction()
                return res.status(400).json({ success: false, message: "Insufficient amount for token purchase." })
            }
        
        const tokens= []

        for(let i=0; i<tokenCount; i++){
            tokens.push ({
                tokenCode: crypto.randomBytes(8).toString('hex'),
                user: user._id,
                mess_id: user.mess_id,
                issued_by: req.user.username,
                issuer_role: req.user.role,
                expiryDate: new Date(Date.now() + tokenData.duration * 24 * 60 * 60 * 1000),
                redeemed: false,
                amount: tokenData.price,
                transactionId: payment_id
            })
        }
        
        try{        
            const transaction = new Transaction({
                transaction_id: paymentData.id,
                order_id: paymentData.order_id,
                user_id: req.user.id,
                mess_id: req.user.mess_id,
                username: req.user.username,
                amount: amount,
                currency: paymentData.currency,
                status: paymentData.status,
                payment_method: paymentData.method,
                tokens_purchased: tokenCount,
                token_validity: new Date(Date.now() + tokenData.duration * 24 * 60 * 60 * 1000),
                razorpay_signature: signature
            })
            await transaction.save()

        }catch(err){
             await session.abortTransaction()
             console.error("Error in Token Issue API", err.message)
             return res.status(500).json({ success: false, error: "Internal Server Error", message: "Error in issueing tokens.Try again later."})
        }

        let insertedMany
        try{
            insertedMany= await Token.insertMany(tokens, { session })
            user.tokens.push(...insertedMany.map(token => token._id))
            await user.save({ session })

        }catch(err){
             await session.abortTransaction()
             console.error("Error in Token Issue API", err.message)
             return res.status(500).json({ success: false, error: "Internal Server Error", message: "Error in issueing tokens.Try again later."})
        }

        const titleForOwner= "Token Issued."
        const bodyForOwner= `${req.user.username} has Issued ${tokenCount} tokens to ${student_username}.`

        const owner= await User.findOne({ username: req.user.username, mess_id: req.user.mess_id, role: 'owner'})
            
        let pushSent= false

        const ownerTokens= await PushNotificationToken.find({ userId: owner._id, mess_id: owner.mess_id })
            if(ownerTokens.length){
                const tokens = ownerTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(tokens, {
                        title: titleForOwner,
                        body: bodyForOwner
                    })
                    pushSent= true
                }catch(err){
                    console.log(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Owner.")
            }

        const titleForStudent= "Token Issued."
        const bodyForStudent= `${tokenCount} tokens issued to you.`

        const studentData= await User.findOne({ username: student_username, mess_id: req.user.mess_id, role: 'student'})
            if(!studentData){
                console.log("No Student present with the given username.")
            }

        const studentTokens= await PushNotificationToken.find({ userId: studentData._id, mess_id: req.user.mess_id })
            if (studentTokens.length) {
                const studentTokensArray = studentTokens.map(entry => entry.token)
                try{
                    await sendPushNotifications(studentTokensArray, {
                        title: titleForStudent,
                        body: bodyForStudent
                    })
                    pushSent= true
                }catch(err){
                    console.log(err.message)
                    pushSent= false
                }
            }else{
                console.log("No Push-Notification-Tokens found for Student.")
            }

        try{
            await Notification.create([{
                mess_id: req.user.mess_id,         
                student: user._id,
                student_username: user.username,   
                type: "transaction",
                title: "Token Issued",
                message: `${req.user.username} issued ${tokenCount} to ${user.username}`,
                data: { tokenCount: tokenCount },
                notificationType: "both",
                pushSent: pushSent,
                pushResponse: null
            }], { session })

        }catch(err){
            await session.abortTransaction()
            console.error("Error in Token Issue API", err.message)
            return res.status(500).json({ success: false, error: "Internal Server Error", message: "Error in issueing tokens.Try again later."})
        }
  
        await session.commitTransaction()
        console.log("Token Issued Successfully.")
        return res.status(200).json({ success: true, message: ` ${tokenCount} Token Purchased.` })

    }catch(err){
        await session.abortTransaction()
        console.error("Error in payment varification API.",err.message)
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Internal Server Error.Try again later."})

    } finally {
        await session.endSession()
    }
}


exports.handlePostPushNotificationToken = async (req, res) => {
    try {
        const { token } = req.body
            if (!token) {
                return res.status(400).json({ success: false, message: 'Push notification token is required.' });
            }
            
        const ipAddress = req.headers['x-forwarded-for']?.split(',').shift() || req.socket?.remoteAddress || 'unknown'
        const browserInfo = req.headers['user-agent'] || 'unknown'
        const userId = req.user.id
        const mess_id= req.user.mess_id
    
        const response = await PushNotificationToken.findOneAndUpdate(
            { token },
            { userId, mess_id, ipAddress, browserInfo, lastUpdated: new Date() },
            { upsert: true, new: true }
        )
        
        console.log("Push Notification Token registered or reassigned.")
        return res.status(200).json({ success: true, message: "Token registered." })
    
    } catch (err) {
        console.error("Error saving push token:", err)
        return res.status(500).json({ success: false, message: "Internal server Error" })
    }
}


exports.handleGetAllTokenConfigurations= async(req, res)=>{
    try{
        const mess_id = req.user.mess_id

        if (!mess_id || typeof mess_id !== "string") {
            return res.status(400).json({ success: false, message: "Invalid or missing mess_id in request." })
        }

        const tokenConfig = await TokenPrice.find({ mess_id })
                                       .sort({ createdAt: -1 })
                                       .lean()
        if(!tokenConfig){
            return res.status(404).json({ success: false, message: "No token Configuration present."})
        }
        
        console.log(`Token Config sent for mess_id : ${mess_id}`)
        return res.status(200).json({ success: true, message: "Token configurations retrieved successfully.", data: tokenConfig })

    }catch(err){
        console.log('Error in the Get Token Config API.', err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error."})
    }
}


exports.PostCreateLinkedAccount= async (req, res)=>{        // In-Progress API
    try{
        const { email, contact, reference_id, business_name, account_holder_name, ifsc, account_number } = req.body
        if (!email || !contact || !reference_id || !business_name || !account_holder_name || !ifsc || !account_number) {
            return res.status(400).json({ message: 'Missing required fields' })
        }

        const accountExist= await SubAccount.findOne({ reference_id: reference_id })
        if( accountExist ){
            return res.status(409).json({ message: 'Linked account already exists for this reference ID' })
        }

        const data = {
            email,
            contact: "9993336584",
            type: 'vendor',
            reference_id: reference_id,
            legal_business_name: business_name,
            business_type: 'individual',
            customer_facing_business_name: business_name,
            notes: { pnr: "nothing"},
            bank_account: {
              name: account_holder_name,
              ifsc,
              account_number: account_number
            },
            profile:{
                "category":"healthcare",
                "subcategory":"clinic",
                "addresses":{
                    "registered":{
                        "street1":"507, Koramangala 1st block",
                        "street2":"MG Road",
                        "city":"Bengaluru",
                        "state":"KARNATAKA",
                        "postal_code":"560034",
                        "country":"IN"
                    }
                }
            },
            legal_info:{
                "pan":"AAACL1234C",
                "gst":"18AABCU9603R1ZM"
            }
          }
        try{
            const response = await RazorpayInstance.accounts.create(data)
        }catch(err){
            console.error("Error in Sub-account Linking API.",err)
            return res.status(500).json({ success: false, error: "Internal Server Error", message: "Internal Server Error.Error in Account creation."})
        }

        const SubAccountData= await SubAccount.create({
            userId : req.user._id,
            razorpayAccountId : response.id,
            referenceId : reference_id,
            email : email,
            contact: contact,
            businessName : business_name,
            accountHolderName : account_holder_name ,
            ifsc : ifsc,
            accountNumber : account_number,
        })

        return res.status(200).json({ success: true, message: 'Linked account created successfully', razorpayAccountId: response.id, linkedAccount: newLinkedAccount })

    }catch(err){
        console.error("Error in Sub-account Linking API.",err)
        return res.status(500).json({ success: false, error: "Internal Server Error", message: "Internal Server Error.Try again later."})
    }
}
