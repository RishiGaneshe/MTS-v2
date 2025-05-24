const { verifyToken }= require('../services/jwtToken.js')
const secret= process.env.Secret
const { redisClient } = require("../services/redisConnection.js")
const Notification= require('../models/notificationForOwner.js')
const TokenPrice= require('../models/messTokenPrice.js')
const crypto = require('crypto')
const Transaction= require('../models/transactionSchema.js')



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
        const transactionData= await Transaction.find({ username: req.user.username, _id: req.user.id, mess_id: req.user.mess_id})
            if(!transactionData) {
                return res.status(404).json({ success: false, message: 'No cash Transactions/token issued by the user.' })
            }

        console.log("cash transaction data for owner sent successfully.")
        return res.status(200).json({ success: true, count: notifications.length, data: transactionData })

    }catch(err){
        console.error('Error fetching cash-transaction data :', err.message)
        return res.status(500).json({ success: false, message: 'Internal Server Error.' })
    }
}


exports.handlePostCreateTokenPrice= async(req, res)=>{
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

            const result = await TokenPrice.create({
                id: generatedId,
                mess_id: req.user.mess_id,
                price: tokenPrice,
                duration,
                name: name.trim(),
                description: description || "N/A",
                metadata: metadata || {},
            })

        console.log("Token price and duration set.")
        return res.status(200).json({ success: true, message: `Token Configuration Added.`, data: result })

    }catch(err){
        console.error("Error in Owner set token price function:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error." })
    }
}


exports.handlePostUpdateTokenConfiguration= async(req, res)=>{
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
            { new: true }
          )
    
        if (!updated) {
            return res.status(404).json({ success: false, message: "Token configuration not found or unauthorized."})
        }
    
        console.log("Token price and duration updated.")
        return res.status(200).json({ success: true, message: "Token Configuration Updated.", data: updated })

      } catch (err) {
        console.error("Error updating token price:", err.message);
        return res.status(500).json({ success: false, message: "Internal Server Error."})
      }
}


exports.handleDeleteTokenConfiguration = async (req, res) => {
  try {
        const { _id } = req.body

        if (!_id || typeof _id !== "string") {
        return res.status(400).json({ success: false, message: "Missing or invalid token configuration ID (_id)." })
        }

        const mess_id  = req.user.mess_id
        const deleted = await TokenPrice.findOneAndDelete({ _id, mess_id })

        if (!deleted) {
        return res.status(404).json({ success: false, message: "Token configuration not found or unauthorized."})
        }

        console.log("Token configuration deleted.")
        return res.status(200).json({ success: true, message: "Token configuration deleted successfully.", data: deleted })

  }catch (err) {
        console.error("Error deleting token configuration:", err.message)
        return res.status(500).json({ success: false, message: "Internal Server Error."})
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
        return res.status(500).json({ success: false, message: "Internal Server Error." });
    }
}