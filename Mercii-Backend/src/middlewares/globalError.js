const status = require('http-status');
const APIError = require('../utils/APIError');
const logger = require("../utils/logger");

const handleSequelizeUniqueConstraintError = (err) => {
  // Infer the violating field from Sequelize error structure or Postgres detail
  let field = err?.errors?.[0]?.path || (err?.fields && Object.keys(err.fields)[0]);
  if (!field && err?.original?.detail) {
    const match = err.original.detail.match(/\(([^)]+)\)=/); // e.g., Key (email)=(x) already exists.
    if (match) field = match[1];
  }

  let message;
  switch (field) {
    case 'email':
      message = 'Email already exists';
      break;
    case 'phoneNumber':
      message = 'Phone number already exists';
      break;
    case 'remitoneCustomerId':
      message = 'Remitone customer id already exists';
      break;
    case 'googleId':
      message = 'Google ID already exists';
      break;
    default:
      message = field ? `${field} already exists` : 'Duplicate value violates unique constraint';
  }

  return new APIError(message, status.BAD_REQUEST);
};

const handleSequelizeValidationError = (err) => {
  const errMsgs = err.errors.map((error) => error.message);

  return new APIError(errMsgs[0], status.BAD_REQUEST);
};

const handleJsonWebTokenError = (err) => {
  const errMsg = 'Provide valid auth token';

  return new APIError(errMsg, status.BAD_REQUEST);
};

module.exports = (err, req, res, next) => {
  let error;
  if (err.name === 'SequelizeUniqueConstraintError')
    error = handleSequelizeUniqueConstraintError(err);
  else if (err.name === 'SequelizeValidationError')
    error = handleSequelizeValidationError(err);
  else if (err.type === 'StripeInvalidRequestError')
    error = new APIError('Provided account details are incorrect', 400);
  else if (err.name === 'JsonWebTokenError')
    error = handleJsonWebTokenError(err);
  else if (err instanceof APIError)
    error = new APIError(err.message, err.statusCode);
  else
    error = new APIError(
      'There is some internal error with server',
      status.INTERNAL_SERVER_ERROR,
    );

  logger.error(err);
  console.log(err);

  // Send the error response
  res.status(error.statusCode || 500).json({
    success: false, // Explicitly set success to false
    message: error.message, // Send the error message
  });
};
