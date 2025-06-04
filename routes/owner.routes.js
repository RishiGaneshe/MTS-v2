const express= require('express')
const router= express.Router()
const Owner= require('../controllers/owner.controller')
const Common= require('../controllers/common.controller')



router.get("/notifications", Owner.handleNotificationForOwner)

router.get("/get-all-students", Owner.handleGetAllMessStudent)                  // ( New )

router.get("/all-transactions", Owner.handleGetOwnerTransactionsOfCash)         // ( New )

router.get("/all-tokens", Owner.handleGetAllIssuedTokensByMess)                 // ( New )

router.get("/mess-profile", Owner.handleGetMessProfileData)                     // ( New )

router.get("/redeemed-token-history", Owner.handleGetAllRedeemedTokensHistory)  // ( New )

router.get("/stats-todays", Owner.handleGetTodaysStatsForMess)                  // ( New )

router.get("/stats-mess-students", Owner.handleGetStatsForStudent)              // ( New )

router.get("/stats-mess-tokens", Owner.handleGetStatsForMessTokens)             // ( New )

router.get("/stats-mess-transactions", Owner.handleGetStatsOfTransaction)       // ( New )





router.post("/owner-dashboard", Owner.handleHelloOwner)

router.post("/logout", Owner.handleOwnerLogout)

router.post("/payment-by-owner", Common.handleVerifyPaymentsDoneByOwners)       // ( New )

router.post("/add-token-price", Owner.handlePostCreateTokenPrice)               // ( New )

router.post("/update-token-config", Owner.handlePostUpdateTokenConfiguration)   // ( New )

router.post("/delete-token-config", Owner.handleDeleteTokenConfiguration)       // ( New )

router.post("/delete-student", Owner.handlePostDeleteStudent)                   // ( New )

router.post("/student-details", Owner.handlePostFullStudentDetail)              // ( New )

router.post("/add-student", Owner.handlePostAddStudentsToMess)                  // ( New )

router.post("/update-mess-profile", Owner.handlePostUpdateMessProfile)          // ( New )




router.post("/link-account", Common.PostCreateLinkedAccount)




module.exports= router