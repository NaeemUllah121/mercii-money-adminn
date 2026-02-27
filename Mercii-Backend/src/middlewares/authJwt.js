const passport = require('passport');
const APIError = require('../utils/APIError.js');
const status = require('http-status');
const { MESSAGES } = require('../utils/constants.js');

exports.authJwt = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, function (err, user, info) {
    if (info || err)
      return next(new APIError(MESSAGES.TOKEN_NOT_VALID, status.UNAUTHORIZED));
    req.user = user;
    next();
  })(req, res, next);
};

exports.canMakeTransaction = (req, res, next) => {
  console.log(req.user)

  if (req.user.plan !== 'plus') {
    const remainingLimit = req.user.transferLimit - req.user.usedLimit;
    if (req.body.amount > remainingLimit) {
      return next(new APIError("Transaction amount exceeds remaining limit.", status.UNAUTHORIZED));
    }
    next();
  }

  next();
};