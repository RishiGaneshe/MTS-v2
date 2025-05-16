const { admin }= require('../configs/fcm.config')


exports.sendPushNotifications= async (tokensArray, messageData)=>{
    try{
        const { title, body }= messageData
        const messageBase = {
            notification: { title, body },
        }

        for (const token of tokensArray) {
            try {
                const message = { ...messageBase, token }
                await admin.messaging().send(message)
                console.log(`Push sent to token: ${token}`)
            }catch (err) {
                console.error(`Failed to send push to token: ${token}`, err)
            }
        }
        console.log("All push notifications processed.")
    }catch(err){
        console.error(`Failed to send push notifications.`, err)
        throw err
    }
}