const mongoose = require("mongoose")

const tokenPriceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    mess_id: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }                                
)

module.exports = mongoose.model("TokenPrice", tokenPriceSchema)
