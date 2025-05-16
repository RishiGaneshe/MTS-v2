const express= require('express')
const router= express.Router()
const Owner= require('../controllers/owner.controller')
const Common= require('../controllers/common.controller')



router.get("/notifications", Owner.handleNotificationForOwner)

router.post("/owner-dashboard", Owner.handleHelloOwner)

router.post("/link-account", Common.PostCreateLinkedAccount)

router.post("/logout", Owner.handleOwnerLogout)


module.exports= router