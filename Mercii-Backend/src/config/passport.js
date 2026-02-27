const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const status = require('http-status');
const db = require('../models');
const { MODELS, MESSAGES } = require('../utils/constants');

exports.getJwtStrategy = () => {
  const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET_KEY,
  };
  return new JwtStrategy(options, async (jwtPayload, done) => {
    const user = await db[MODELS.USER].findByPk(jwtPayload.id);
    if (!user) {
      return done(
        {
          message: MESSAGES.TOKEN_NOT_VALID,
          status: status.UNAUTHORIZED,
        },
        null,
      );
    }
    done(false, user);
  });
};