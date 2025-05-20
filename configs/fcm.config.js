const admin= require('firebase-admin')
const serviceAccount = require('./dfic-notification-firebase-adminsdk-fbsvc-1be811060a.json')


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
})

module.exports= admin