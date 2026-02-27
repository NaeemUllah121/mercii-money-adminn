const Joi = require('joi');

const idSchema = Joi.object({
  id: Joi.required().messages({
    'any.required': `ID is a required field`,
  }),
});

// refId validation used for merchantPaymentId in webhooks
// Accept either:
// - Numeric only with length 14..16 (current refId format), or
// - A valid UUID (for backward compatibility)
const validateRefId = Joi.object({
  merchantPaymentId: Joi.alternatives().try(
      Joi.string().pattern(/^\d{14,16}$/),
      Joi.string().uuid()
    )
    .required()
    .messages({
      'alternatives.match': 'Merchant Payment ID must be 14–16 digits numeric or a valid UUID',
      'any.required': 'Merchant Payment ID is required',
    }),
});



module.exports = {
  idSchema,
  validateRefId
};
