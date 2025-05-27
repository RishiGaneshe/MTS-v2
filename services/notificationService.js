const Notification= require('../models/notificationForOwner')


exports.notificationFunction= async(mess_id, _id, username, type, title, message, data, notificationType, pushSent, session)=>{
    try{
        const payload= { mess_id, _id, username, type, title, message, data, notificationType, pushSent, session }
    
        const requiredFields = ['mess_id', '_id', 'username', 'type', 'title', 'message', 'data', 'notificationType', 'pushSent']
        const missingFields = []

        for (const field of requiredFields) {
            if ( payload[field] === undefined || payload[field] === null || payload[field] === '') {
              missingFields.push(field)
            }
        }

        if (missingFields.length > 0) {
            throw new Error('notificationFunction. fields are required')
        }
        
        return await Notification.create([{
                        mess_id: mess_id,         
                        student: _id,
                        student_username: username,   
                        type: type,
                        title: title,
                        message: message,
                        data: data,
                        notificationType: notificationType,
                        pushSent: pushSent,
                        pushResponse: null
                    }], { session })
    }catch(err){
        console.error('Error in Notification Function: ', err)
        throw err
    }
}