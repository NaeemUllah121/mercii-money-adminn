const Joi = require('joi')

const transactionSchema = Joi.object({
    benificaryId: Joi.string()
        .guid({ version: "uuidv4" })
        .required()
        .messages({
            "any.required": "Beneficiary ID is required.",
            "string.guid": "Beneficiary ID must be a valid UUID (v4).",
        }),

    amount: Joi.number()
        .positive()
        .required()
        .messages({
            "number.base": "Amount must be a valid number.",
            "number.positive": "Amount must be greater than 0.",
            "any.required": "Amount is required.",
        }),

    amountInPkr: Joi.number()
        .positive()
        .required()
        .messages({
            "number.base": "Amount in PKR must be a valid number.",
            "number.positive": "Amount in PKR must be greater than 0.",
            "any.required": "Amount in PKR is required.",
        }),

    sourceOfFund: Joi.string()
        .trim()
        .min(1)
        .required()
        .messages({
            "string.base": "Source of fund must be a valid string.",
            "string.empty": "Source of fund cannot be empty.",
            "string.min": "Source of fund cannot be empty.",
            "any.required": "Source of fund is required.",
        }),

    sendingReason: Joi.string()
        .trim()
        .min(1)
        .required()
        .messages({
            "string.base": "Sending reason must be a valid string.",
            "string.empty": "Sending reason cannot be empty.",
            "string.min": "Sending reason cannot be empty.",
            "any.required": "Sending reason is required.",
        }),

    collection_point_id: Joi.string()
        .trim()
        .optional()
        .allow(null, '')
        .messages({
            "string.base": "Collection point ID must be a valid string.",
        }),

    collection_point: Joi.string()
        .trim()
        .optional()
        .allow(null, '')
        .messages({
            "string.base": "Collection point must be a valid string.",
        }),

    collection_point_address: Joi.string()
        .trim()
        .optional()
        .allow(null, '')
        .messages({
            "string.base": "Collection point address must be a valid string.",
        }),

    collection_point_city: Joi.string()
        .trim()
        .optional()
        .allow(null, '')
        .messages({
            "string.base": "Collection point city must be a valid string.",
        }),

    fundingAccountName: Joi.string()
        .trim()
        .min(2)
        .max(255)
        .optional()
        .messages({
            "string.base": "Funding account name must be a valid string.",
            "string.min": "Funding account name must be at least 2 characters.",
            "string.max": "Funding account name cannot exceed 255 characters.",
        }),
});

module.exports = {
    transactionSchema
}