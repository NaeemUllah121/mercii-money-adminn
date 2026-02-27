const admin = require('../services/firebase');

const sendNotificationToDevice = async (token, title, body, data = {}) => {
  const message = {
    notification: { title, body },
    data, // optional custom data
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Notification sent:", response);
    return response;
  } catch (error) {
    console.error("Error sending notification:", error);
    // Do not throw to avoid crashing the process due to unhandled promise rejections
    // Callers should treat a null/falsey response as a send failure
    return null;
  }
};

module.exports = { sendNotificationToDevice };
