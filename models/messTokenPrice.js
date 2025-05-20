const mongoose = require("mongoose")

const tokenPriceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    mess_id: { type: String, required: true, unique: true },                
    price: { type: Number, required: true, min: 0 },       
    duration: { type: Number, required: true, min: 1 },   
    currency: { type: String, default: "INR" },            
    createdAt: { type: Date, default: Date.now },         
  },
  { timestamps: true }                                    
)

module.exports = mongoose.model("TokenPrice", tokenPriceSchema)
