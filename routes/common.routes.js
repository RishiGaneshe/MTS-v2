const express= require('express')
const router= express.Router()
const Common= require('../controllers/common.controller')



router.get("/get-token-config", Common.handleGetAllTokenConfigurations)

router.get("/profile-data", Common.handleGetBothRoleProfileData)



router.post("/create-order", Common.handleRazorpayCreateOrder)

router.post("/verify-payment", Common.handleVerifyPayments)

router.post("/push-notification-token", Common.handlePostPushNotificationToken)



router.patch("/profile-update", Common.handlePatchBothRoleProfile)




module.exports= router