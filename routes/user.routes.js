const express= require('express')
const router= express.Router()
const User= require('../controllers/user.controller')


router.get('/', User.handleGetHomePage)

router.post("/sign-up", User.handleSendEmailForSignUp )

router.post("/sign-up/otp-verify", User.handlePostVerifyOTP)

router.post("/login", User.handlePostUserLogin)

router.post("/password-reset", User.handlePostSendPasswordResetOTP)

router.post("/password-reset/verify-otp")


module.exports= router