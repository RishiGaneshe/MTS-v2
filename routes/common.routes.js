const express= require('express')
const router= express.Router()
const Common= require('../controllers/common.controller')



router.get("/get-token-config", Common.handleGetAllTokenConfigurations)


router.post("/create-order", Common.handleRazorpayCreateOrder)

router.post("/verify-payment", Common.handleVerifyPayments)

router.post("/push-notification-token", Common.handlePostPushNotificationToken)


module.exports= router