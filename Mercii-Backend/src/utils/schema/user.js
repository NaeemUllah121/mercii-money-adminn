const Joi = require('joi');

const verifyOtpSchema = Joi.object({
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be exactly 6 digits',
      'any.required': 'OTP is required'
    })
});

const setPasscodeSchema = Joi.object({
  passcode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Passcode must be exactly 6 digits',
      'any.required': 'Passcode is required'
    }),

  confirmPasscode: Joi.string()
    .valid(Joi.ref('passcode'))
    .required()
    .messages({
      'any.only': 'Passcodes do not match',
      'any.required': 'Passcode confirmation is required'
    })
});

const loginSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+44[1-9]\d{8,10}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format. Must be a valid UK phone number (e.g., +447123456789)',
      'string.empty': 'Phone number cannot be empty'
    }),

  passcode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Passcode must be exactly 6 digits',
      'any.required': 'Passcode is required'
    }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Enter a valid email',
    'string.empty': 'Email cannot be empty'
  }),
});

const signupSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+44[1-9]\d{8,10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid UK phone number format. Must be a valid UK phone number (e.g., +447123456789)',
      'any.required': 'Phone number is required'
    }),

  // Legacy validation - kept for reference
  // phoneNumber: Joi.string()
  //   .pattern(/^\+44[1-9]\d{8,9}$/) // UK phone numbers in E164 format
  //   .required()
  //   .messages({
  //     'string.pattern.base': 'Invalid UK phone number format. Must be in E164 format (e.g., +447123456789)',
  //     'any.required': 'Phone number is required'
  //   }),
  email: Joi.string().required().email().messages({
    'any.required': `Email is a required field`,
    'string.empty': `Email cannont be empty`,
    'string.email': `Enter a valid email`,
  }),
  fullName: Joi.string().required().min(2).max(16).messages({
    'any.required': 'full Name is required',
    'string.empty': `full Name cannont be empty`,
  }),
  fcm: Joi.string().optional().messages({
    'string.empty': 'FCM token cannot be empty'
  }),
  uniqueId: Joi.string().optional().messages({
    'string.empty': 'Token cannot be empty'
  })
});

const resetPasscodeSchema = Joi.object({
  newPasscode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'New passcode must be exactly 6 digits',
      'any.required': 'New passcode is required'
    }),

  confirmPasscode: Joi.string()
    .valid(Joi.ref('newPasscode'))
    .required()
    .messages({
      'any.only': 'Passcodes do not match',
      'any.required': 'Passcode confirmation is required'
    })
});

const changePasscodeSchema = Joi.object({
  oldPasscode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Old passcode must be exactly 6 digits',
      'any.required': 'Old passcode is required'
    }),

  newPasscode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'New passcode must be exactly 6 digits',
      'any.required': 'New passcode is required'
    }),

  confirmPasscode: Joi.string()
    .valid(Joi.ref('newPasscode'))
    .required()
    .messages({
      'any.only': 'Passcodes do not match',
      'any.required': 'Passcode confirmation is required'
    })
});

// const loginSchema = Joi.object({
//   phoneNumber: Joi.string()
//     .pattern(/^\+?[1-9]\d{1,14}$/)
//     .required()
//     .messages({
//       'string.pattern.base': 'Invalid phone number format',
//       'any.required': 'Phone number is required'
//     }),

//   passcode: Joi.string()
//     .pattern(/^\d{6}$/)
//     .required()
//     .messages({
//       'string.pattern.base': 'Passcode must be exactly 6 digits',
//       'any.required': 'Passcode is required'
//     })
// });

const socialSignInSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'any.required': 'Email is required',
    'string.email': 'Invalid email format'
  }),
  firstName: Joi.string().required().messages({
    'any.required': 'First name is required',
    'string.empty': 'First name cannot be empty'
  }),
  lastName: Joi.string().allow('').optional(),
  authMethod: Joi.string().required().messages({
    'any.required': 'Auth method is required',
    'string.empty': 'Auth method cannot be empty'
  }),
  socialId: Joi.string().required().messages({
    'any.required': 'Social ID is required',
    'string.empty': 'Social ID cannot be empty'
  }),
  // Make FCM optional and allow empty string/null without throwing validation errors
  fcm: Joi.string().allow('', null).optional(),
  uniqueId: Joi.string().optional().messages({
    'string.empty': 'Token cannot be empty'
  })
});

module.exports = {
  verifyOtpSchema,
  setPasscodeSchema,
  loginSchema,
  signupSchema,
  resetPasscodeSchema,
  changePasscodeSchema,
  socialSignInSchema
};