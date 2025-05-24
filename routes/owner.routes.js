const express= require('express')
const router= express.Router()
const Owner= require('../controllers/owner.controller')
const Common= require('../controllers/common.controller')



router.get("/notifications", Owner.handleNotificationForOwner)

router.post("/owner-dashboard", Owner.handleHelloOwner)

router.post("/logout", Owner.handleOwnerLogout)

router.post("/add-token-price", Owner.handlePostCreateTokenPrice)               // ( New )

router.post("/update-token-config", Owner.handlePostUpdateTokenConfiguration)   // ( New )

router.post("/delete-token-config", Owner.handleDeleteTokenConfiguration)       // ( New )



router.post("/link-account", Common.PostCreateLinkedAccount)

router.post("/payment-by-owner", Common.handleVerifyPaymentsDoneByOwners)       // ( New )



module.exports= router