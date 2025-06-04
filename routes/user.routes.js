const express= require('express')
const router= express.Router()
const User= require('../controllers/user.controller')
const Owner= require('../controllers/owner.controller')


router.get('/', User.handleGetHomePage)

router.post("/sign-up", User.handleSendEmailForSignUp )

router.post("/sign-up/otp-verify", User.handlePostVerifyOTP)

router.post("/login", User.handlePostUserLogin)

router.post("/password-reset", User.handlePostSendPasswordResetOTP)

router.post("/google-auth", User.handlePostGoogleAuth)

router.post("/password-reset/verify-otp")            //  in-progress....



router.post("/owner-sign-up", Owner.handleSendEmailForSignUp )

router.post("/owner-sign-up/otp-verify", Owner.handlePostVerifyOTP)

router.post("/owner-login", Owner.handlePostUserLogin)


module.exports= router