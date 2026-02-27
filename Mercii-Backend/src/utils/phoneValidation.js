const Joi = require('joi');

/**
 * Validates if a phone number is in proper E.164 format and is a valid phone number
 * @param {string} phoneNumber - The phone number to validate
 * @param {string} defaultCountry - Default country code (e.g., 'GB' for UK)
 * @returns {Object} - { isValid: boolean, formattedNumber: string, error: string }
 */
function validatePhoneNumber(phoneNumber, defaultCountry = 'GB') {
  try {
    // Basic format validation using regex
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return {
        isValid: false,
        formattedNumber: null,
        error: 'Phone number must be a valid string'
      };
    }

    // Remove any whitespace
    const cleanNumber = phoneNumber.trim();

    // UK phone number validation
    if (defaultCountry === 'GB') {
      // UK phone numbers: +44 followed by 1-9, then 8-10 more digits
      const ukPhonePattern = /^\+44[1-9]\d{8,10}$/;
      
      if (!ukPhonePattern.test(cleanNumber)) {
        return {
          isValid: false,
          formattedNumber: null,
          error: 'Invalid UK phone number format. Must be +44 followed by 10-12 digits (e.g., +447123456789)'
        };
      }
    } else {
      // General E.164 format validation
      const e164Pattern = /^\+[1-9]\d{1,14}$/;
      
      if (!e164Pattern.test(cleanNumber)) {
        return {
          isValid: false,
          formattedNumber: null,
          error: 'Invalid phone number format. Must be in E.164 format (e.g., +1234567890)'
        };
      }
    }

    return {
      isValid: true,
      formattedNumber: cleanNumber,
      error: null
    };
  } catch (err) {
    return {
      isValid: false,
      formattedNumber: null,
      error: `Phone validation error: ${err.message}`
    };
  }
}

/**
 * Formats a phone number to E.164 format
 * @param {string} phoneNumber - The phone number to format
 * @param {string} defaultCountry - Default country code
 * @returns {string|null} - Formatted phone number or null if invalid
 */
function formatPhoneNumber(phoneNumber, defaultCountry = 'GB') {
  const validation = validatePhoneNumber(phoneNumber, defaultCountry);
  return validation.isValid ? validation.formattedNumber : null;
}

/**
 * Checks if a phone number is a UK mobile number (for SMS sending)
 * @param {string} phoneNumber - The phone number to check
 * @returns {boolean} - True if it's a UK mobile number
 */
function isUKMobile(phoneNumber) {
  // UK mobile numbers start with +447 and are typically 13 digits total
  const ukMobilePattern = /^\+447[0-9]{8,10}$/; // More flexible range
  return ukMobilePattern.test(phoneNumber);
}

module.exports = {
  validatePhoneNumber,
  formatPhoneNumber,
  isUKMobile
};
