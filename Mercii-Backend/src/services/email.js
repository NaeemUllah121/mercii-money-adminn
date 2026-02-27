require('dotenv').config();
const APIError = require('../utils/APIError');
const { MESSAGES } = require('../utils/constants');

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);

exports.sendEmailSendGrid = async (email, subject, link) => {
  const msg = {
    to: email,
    from: { email: process.env.MAIL_USERNAME },
    subject: subject,
    html: link,
  };
  try {
    await sgMail.send(msg);
    console.log('Email sent successfully to:', email);
  } catch (error) {
    console.error('Email send error details:', {
      to: email,
      from: process.env.MAIL_USERNAME,
      subject: subject,
      errorMessage: error.message,
      responseBody: error?.response?.body || 'No response body',
      statusCode: error?.response?.statusCode || 'No status code'
    });
    throw new APIError(MESSAGES.EMAIL_SEND_ERROR || 'Failed to send email', 500);
  }
};
