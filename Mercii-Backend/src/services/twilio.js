const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { validatePhoneNumber, isUKMobile } = require('../utils/phoneValidation');

exports.sendSMS = async (to, body) => {
    try {
        // Validate phone number before sending SMS
        const validation = validatePhoneNumber(to, 'GB');
        
        if (!validation.isValid) {
            const error = new Error(`Invalid phone number: ${validation.error}`);
            error.code = 'INVALID_PHONE_NUMBER';
            error.phoneNumber = to;
            throw error;
        }

        // Check if it's a UK mobile number (Twilio works best with mobile numbers for SMS)
        if (!isUKMobile(validation.formattedNumber)) {
            console.warn(`Warning: Phone number ${validation.formattedNumber} is not a UK mobile number. Skipping SMS send to avoid Twilio errors.`);
            return {
                success: false,
                skipped: true,
                reason: 'NON_MOBILE_NUMBER',
                to: validation.formattedNumber
            };
        }

        const message = await client.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: validation.formattedNumber,
            body
        });
        
        console.log(`SMS sent successfully. SID: ${message.sid}, To: ${validation.formattedNumber}`);
        return {
            success: true,
            sid: message.sid,
            to: validation.formattedNumber
        };
    } catch (error) {
        // Enhanced error logging
        if (error.code === 'INVALID_PHONE_NUMBER') {
            console.error(`Phone validation failed for ${error.phoneNumber}:`, error.message);
        } else {
            console.error('Failed to send SMS:', error);
        }
        throw error;
    }
}