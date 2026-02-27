const status = require('http-status');
const { MESSAGES, MODELS } = require('../utils/constants');
const catchAsync = require('../utils/catchAsync');
const { APIresponse } = require('../utils/APIresponse');
const APIError = require('../utils/APIError');
const jwt = require('jsonwebtoken');
const { create, findOne, update, findByPk } = require('../utils/database');
const { generateOtp, hashPassword, generateExpiry, hashCompare, isOtpExpired, extractPostalCode } = require('../utils/utilityFunctions');

const {
  verifyOtpSchema,
  setPasscodeSchema,
  signupSchema,
  loginSchema,
  resetPasscodeSchema,
  changePasscodeSchema } = require('../utils/schema/user');
const { Op } = require('sequelize');
const { socialSignInSchema } = require('../utils/schema/user');
const db = require('../models');
const { makeUSIRequest } = require('../services/usi');
const { sendNotificationToDevice } = require('../utils/notification');
const { sendEmailSendGrid } = require('../services/email');
const { sendSMS } = require('../services/twilio');


const socialSignIn = catchAsync(async (req, res, next) => {
  const { email, firstName, lastName, authMethod, socialId, fcm, uniqueId } = req.body;

  const { error } = socialSignInSchema.validate(req.body);
  if (error) {
    return next(new APIError(error.details[0].message, status.BAD_REQUEST));
  }
  const isAppleRelay = typeof email === 'string' && email.toLowerCase().includes('@privaterelay.appleid.com');
  let user;
  if (isAppleRelay) {
    // For Apple private relay emails, don't depend on email for identity; use provider identity
    user = await findOne(MODELS.USER, { where: { authMethod, socialId } });
  } else {
    user = await findOne(MODELS.USER, { where: { email: email.toLowerCase(), authMethod, socialId } });
  }

  if (!user) {
    // If a user already exists with this email (regardless of authMethod/socialId),
    // return a clear error instead of creating a duplicate account
    const existingByEmail = await findOne(MODELS.USER, { where: { email: email.toLowerCase() } });
    if (existingByEmail) {
      return next(new APIError(MESSAGES.USER_ALREADY_EXISTS_LOGIN, status.BAD_REQUEST));
    }

    const fullName = [firstName, lastName].filter((p) => p && String(p).trim()).join(' ').trim();
    user = await create(MODELS.USER, {
      fullName,
      email: email.toLowerCase(),
      authMethod,
      socialId,
      isActive: true,
      registrationStep: 'completed',
    });
  }

  // Upsert FCM mapping if provided (do not block social sign-in on errors)
  if (fcm || uniqueId) {
    try {
      const existingFcm = await findOne(MODELS.FCM, { where: { userId: user.id } });
      if (existingFcm) {
        await update(MODELS.FCM, {
          ...(fcm && { fcm }),
          ...(uniqueId && { uniqueId }),
          userId: user.id,
        }, { where: { userId: user.id } });
      } else {
        await create(MODELS.FCM, {
          fcm: fcm || null,
          uniqueId: uniqueId || null,
          userId: user.id,
        });
      }
    } catch (e) {
      console.error('Non-blocking: failed to upsert FCM for social sign-in:', e?.message || e);
    }
  }

  const jwtToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '1 day' }
  );

  const userData = { ...user.get() };
  delete userData.passcode;
  delete userData.otp;
  delete userData.otpExpiry;
  userData.token = jwtToken;

  APIresponse(res, MESSAGES.SUCCESS, userData);
});

/**
 * Check if a social user already exists.
 * Expects: { email, authMethod, socialId }
 * For Apple private relay emails, do not use email in the lookup; rely on { authMethod, socialId }.
 */
const checkSocialUser = catchAsync(async (req, res, next) => {
  const { email, authMethod, socialId } = req.body;

  // Basic validation to ensure required fields are present
  if (!authMethod || !socialId || typeof email !== 'string') {
    return next(new APIError('email, authMethod and socialId are required', status.BAD_REQUEST));
  }

  const isAppleRelay = email.toLowerCase().includes('@privaterelay.appleid.com');

  let user;
  if (isAppleRelay) {
    // For Apple private relay emails, don't depend on email for identity; use provider identity
    user = await findOne(MODELS.USER, { where: { authMethod, socialId } });
  } else {
    user = await findOne(MODELS.USER, { where: { email: email.toLowerCase(), authMethod, socialId } });
  }

  if (!user) {
    return APIresponse(res, MESSAGES.SUCCESS, { exists: false });
  }

  return APIresponse(res, MESSAGES.SUCCESS, { exists: true });
});

/**
 * Social users: send OTP to verify phone number
 */
const sendSocialPhoneOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return next(new APIError('Phone number is required', status.BAD_REQUEST));
  }

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // Generate OTP and expiry
  const otp = await generateOtp(6);
  const expiresIn = await generateExpiry(5); // 5 minutes

  // Update user's phone (unverified) and mark as not verified
  await update(MODELS.USER, {
    phoneNumber,
    isPhoneVerified: false,
  }, { where: { id: userId } });

  // Upsert into forgetPasswordTokens for OTP storage
  const existingToken = await findOne(MODELS.FORGETPASSWORDTOKEN, { where: { userId } });
  if (existingToken) {
    await update(MODELS.FORGETPASSWORDTOKEN, {
      token: otp,
      expiresIn,
    }, { where: { userId } });
  } else {
    await create(MODELS.FORGETPASSWORDTOKEN, {
      userId,
      token: otp,
      expiresIn,
    });
  }

  // Send SMS (enable integration as needed)
  try {
    if (phoneNumber) {
      await sendSMS(phoneNumber, `Your verification code is: ${otp}. Valid for 5 minutes.`);
    }
    // Also try to send a push notification if FCM token exists
    // try {
    //   const userFcm = await findOne(MODELS.FCM, { where: { userId } });
    //   if (userFcm && userFcm.fcm) {
    //     await sendNotificationToDevice(
    //       userFcm.fcm,
    //       'Verification Code',
    //       `Your verification code is: ${otp}. Valid for 5 minutes.`,
    //       { type: 'PHONE_OTP', userId: String(userId) }
    //     );
    //   }
    // } catch (e) {
    //   console.error('Failed to send FCM notification for phone OTP:', e);
    //   // Do not fail the request if notification fails; SMS/email may still deliver
    // }
  } catch (err) {
    console.error('Failed to send phone verification SMS:', err);
    // Check if it's a phone validation error
    if (err.code === 'INVALID_PHONE_NUMBER') {
      return next(new APIError(`Invalid phone number: ${err.phoneNumber}`, status.BAD_REQUEST));
    }
    return next(new APIError(MESSAGES.NOTIFICATION_SEND_FAILED, status.INTERNAL_SERVER_ERROR));
  }

  APIresponse(res, MESSAGES.OTP_SENT_SUCCESSFULLY, {
    expiresIn: 300,
    otp, // remove in production
  });
});

/**
 * Social users: verify phone OTP
 */
const verifySocialPhoneOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { otp } = req.body;

  if (!otp) {
    return next(new APIError('OTP is required', status.BAD_REQUEST));
  }

  // Load user with token relation
  const user = await findOne(MODELS.USER, {
    where: { id: userId },
    include: [
      { model: db[MODELS.FORGETPASSWORDTOKEN], as: 'forgetPasswordTokens' }
    ]
  });

  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  const tokenRow = user.forgetPasswordTokens && user.forgetPasswordTokens[0];
  if (!tokenRow) {
    return next(new APIError(MESSAGES.NO_OTP_FOUND_OR_EXPIRED, status.BAD_REQUEST));
  }

  if (isOtpExpired(tokenRow.expiresIn)) {
    return next(new APIError(MESSAGES.OTP_EXPIRED, status.BAD_REQUEST));
  }

  if (String(tokenRow.token) !== String(otp)) {
    return next(new APIError(MESSAGES.INVALID_OTP, status.BAD_REQUEST));
  }

  // Mark phone verified and clear token
  await update(MODELS.USER, {
    isPhoneVerified: true,
  }, { where: { id: userId } });

  await update(MODELS.FORGETPASSWORDTOKEN, {
    token: null,
    expiresIn: null,
  }, { where: { userId } });

  const updated = await findByPk(MODELS.USER, userId);
  const userData = { ...updated.get() };
  delete userData.passcode;

  APIresponse(res, MESSAGES.OTP_VERIFIED_SUCCESSFULLY, userData);
});

/**
 * Request OTP to update user's email along with fullName.
 * Requires both: email (new) and fullName. Sends OTP to the new email.
 */
const requestUpdateEmailNameOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { email, fullName } = req.body;

  if (!email || !fullName) {
    return next(new APIError('Both email and fullName are required', status.BAD_REQUEST));
  }

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // If email is changing, ensure uniqueness
  const normalizedEmail = String(email).toLowerCase();
  if (normalizedEmail !== (user.email || '').toLowerCase()) {
    const existsEmail = await findOne(MODELS.USER, { where: { email: normalizedEmail, id: { [Op.ne]: userId } } });
    if (existsEmail) return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
  }

  // Generate OTP and upsert token row
  const otp = await generateOtp(6);
  const expiresIn = await generateExpiry(5); // 5 minutes
  const tokenRow = await findOne(MODELS.FORGETPASSWORDTOKEN, { where: { userId } });
  if (tokenRow) {
    await update(MODELS.FORGETPASSWORDTOKEN, { token: otp, expiresIn }, { where: { userId } });
  } else {
    await create(MODELS.FORGETPASSWORDTOKEN, { userId, token: otp, expiresIn });
  }

  // Send email with OTP to the new email address
  try {
    await sendEmailSendGrid(normalizedEmail, 'Verification Code', `Your verification code is: ${otp}. Valid for 5 minutes.`);
  } catch (emailError) {
    console.error('Failed to send email for email/name update:', emailError.message);
    return next(new APIError(MESSAGES.NOTIFICATION_SEND_FAILED, status.INTERNAL_SERVER_ERROR));
  }

  APIresponse(res, MESSAGES.OTP_SENT_SUCCESSFULLY, { expiresIn: 300 /* 5 min */, otp });
});

/**
 * Verify OTP and apply new email and fullName.
 */
const verifyUpdateEmailNameOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { otp, email, fullName } = req.body;

  if (!otp) return next(new APIError('OTP is required', status.BAD_REQUEST));
  if (!email || !fullName) return next(new APIError('Both email and fullName are required', status.BAD_REQUEST));

  const user = await findOne(MODELS.USER, {
    where: { id: userId },
    include: [{ model: db[MODELS.FORGETPASSWORDTOKEN], as: 'forgetPasswordTokens' }]
  });
  if (!user) return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));

  const tokenRow = user.forgetPasswordTokens && user.forgetPasswordTokens[0];
  if (!tokenRow) return next(new APIError(MESSAGES.NO_OTP_FOUND_OR_EXPIRED, status.BAD_REQUEST));
  if (isOtpExpired(tokenRow.expiresIn)) return next(new APIError(MESSAGES.OTP_EXPIRED, status.BAD_REQUEST));
  if (String(tokenRow.token) !== String(otp)) return next(new APIError(MESSAGES.INVALID_OTP, status.BAD_REQUEST));

  // Re-check email uniqueness before applying
  const normalizedEmail = String(email).toLowerCase();
  if (normalizedEmail !== (user.email || '').toLowerCase()) {
    const existsEmail = await findOne(MODELS.USER, { where: { email: normalizedEmail, id: { [Op.ne]: userId } } });
    if (existsEmail) return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
  }

  await update(MODELS.USER, { email: normalizedEmail, fullName }, { where: { id: userId } });

  // Clear OTP
  await update(MODELS.FORGETPASSWORDTOKEN, { token: null, expiresIn: null }, { where: { userId } });

  const updated = await findByPk(MODELS.USER, userId);
  const userData = { ...updated.get() };
  delete userData.passcode;

  APIresponse(res, MESSAGES.OTP_VERIFIED_SUCCESSFULLY, userData);
});

/**
 * Request OTP to update user's phoneNumber and/or email.
 * It only sends OTP after ensuring uniqueness; no DB updates to contact fields yet.
 */
const requestUpdateContactOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { phoneNumber, email } = req.body;

  if (!phoneNumber && !email) {
    return next(new APIError('Provide at least one of phoneNumber or email', status.BAD_REQUEST));
  }

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // Uniqueness checks if values are changing
  if (phoneNumber && phoneNumber !== user.phoneNumber) {
    const existsPhone = await findOne(MODELS.USER, { where: { phoneNumber, id: { [Op.ne]: userId } } });
    if (existsPhone) return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
  }

  if (email && email.toLowerCase() !== (user.email || '').toLowerCase()) {
    const existsEmail = await findOne(MODELS.USER, { where: { email: email.toLowerCase(), id: { [Op.ne]: userId } } });
    if (existsEmail) return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
  }

  const otp = await generateOtp(6);
  const expiresIn = await generateExpiry(5); // 5 minutes

  // Upsert OTP record
  const tokenRow = await findOne(MODELS.FORGETPASSWORDTOKEN, { where: { userId } });
  if (tokenRow) {
    await update(MODELS.FORGETPASSWORDTOKEN, { token: otp, expiresIn }, { where: { userId } });
  } else {
    await create(MODELS.FORGETPASSWORDTOKEN, { userId, token: otp, expiresIn });
  }

  // Send OTP via selected channels
  const results = { sms: false, email: false };
  
  if (phoneNumber) {
    try {
      const userFcm = await findOne(MODELS.FCM, { where: { userId } });
      // if (userFcm && userFcm.fcm) {
      //   await sendNotificationToDevice(
      //     userFcm.fcm,
      //     'Verification Code',
      //     `Your verification code is: ${otp}. Valid for 5 minutes.`,
      //     { type: 'PHONE_OTP', userId: String(userId) }
      //   );
      // }
      await sendSMS(phoneNumber, `Your verification code is: ${otp}. Valid for 5 minutes.`);
      results.sms = true;
    } catch (smsError) {
      console.error('Failed to send SMS for contact update:', smsError.message);
      if (smsError.code === 'INVALID_PHONE_NUMBER') {
        console.error(`Invalid phone number provided: ${smsError.phoneNumber}`);
      }
      // Continue with email if SMS fails
    }
  }
  
  if (email) {
    try {
      await sendEmailSendGrid(email, 'Verification Code', `Your verification code is: ${otp}. Valid for 5 minutes.`);
      results.email = true;
    } catch (emailError) {
      console.error('Failed to send email for contact update:', emailError.message);
    }
  }
  
  // Ensure at least one delivery method succeeded
  if (!results.sms && !results.email) {
    console.error('Failed to send OTP via any channel');
    return next(new APIError(MESSAGES.NOTIFICATION_SEND_FAILED, status.INTERNAL_SERVER_ERROR));
  }

  APIresponse(res, MESSAGES.OTP_SENT_SUCCESSFULLY, { expiresIn: 300, otp });
});

/**
 * Verify OTP and apply pending contact changes.
 */
const verifyUpdateContactOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { otp, phoneNumber, email } = req.body;

  if (!otp) {
    return next(new APIError('OTP is required', status.BAD_REQUEST));
  }

  const user = await findOne(MODELS.USER, {
    where: { id: userId },
    include: [{ model: db[MODELS.FORGETPASSWORDTOKEN], as: 'forgetPasswordTokens' }]
  });
  if (!user) return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));

  const tokenRow = user.forgetPasswordTokens && user.forgetPasswordTokens[0];
  if (!tokenRow) return next(new APIError(MESSAGES.NO_OTP_FOUND_OR_EXPIRED, status.BAD_REQUEST));
  if (isOtpExpired(tokenRow.expiresIn)) return next(new APIError(MESSAGES.OTP_EXPIRED, status.BAD_REQUEST));
  if (String(tokenRow.token) !== String(otp)) return next(new APIError(MESSAGES.INVALID_OTP, status.BAD_REQUEST));

  // Apply updates (re-check uniqueness)
  const updates = {};
  if (phoneNumber && phoneNumber !== user.phoneNumber) {
    const existsPhone = await findOne(MODELS.USER, { where: { phoneNumber, id: { [Op.ne]: userId } } });
    if (existsPhone) return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
    updates.phoneNumber = phoneNumber;
    updates.isPhoneVerified = true; // mark verified via OTP
  }
  if (email && email.toLowerCase() !== (user.email || '').toLowerCase()) {
    const existsEmail = await findOne(MODELS.USER, { where: { email: email.toLowerCase(), id: { [Op.ne]: userId } } });
    if (existsEmail) return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
    updates.email = email.toLowerCase();
  }

  if (!Object.keys(updates).length) {
    // Nothing to update: just clear OTP and return success to avoid unnecessary erroring
    await update(MODELS.FORGETPASSWORDTOKEN, { token: null, expiresIn: null }, { where: { userId } });
    const current = await findByPk(MODELS.USER, userId);
    const currentData = { ...current.get() };
    delete currentData.passcode;
    return APIresponse(res, MESSAGES.OTP_VERIFIED_SUCCESSFULLY, currentData);
  }

  await update(MODELS.USER, updates, { where: { id: userId } });

  // Clear OTP
  await update(MODELS.FORGETPASSWORDTOKEN, { token: null, expiresIn: null }, { where: { userId } });

  const updated = await findByPk(MODELS.USER, userId);
  const userData = { ...updated.get() };
  delete userData.passcode;

  APIresponse(res, MESSAGES.OTP_VERIFIED_SUCCESSFULLY, userData);
});

const signup = catchAsync(async (req, res, next) => {
  const { phoneNumber, fullName, email, fcm, uniqueId } = req.body;
  const { error } = signupSchema.validate(req.body);
  if (error) {
    return next(new APIError(error.details[0].message, status.BAD_REQUEST));
  }

  // Enforce uniqueness only if the existing account is verified
  const existingByEmail = await findOne(MODELS.USER, {
    where: { email: email.toLowerCase(), isPhoneVerified: true }
  });
  if (existingByEmail) {
    return next(new APIError('Email already exist', status.BAD_REQUEST));
  }

  const existingByPhone = await findOne(MODELS.USER, {
    where: { phoneNumber, isPhoneVerified: true }
  });
  if (existingByPhone) {
    return next(new APIError('Phone Number Already exist', status.BAD_REQUEST));
  }

  // Try to find any existing INCOMPLETE registration by phone OR email to reuse
  let user = await findOne(MODELS.USER, {
    where: {
      [Op.or]: [
        { phoneNumber },
        { email: email.toLowerCase() },
      ],
      // anything not completed is considered reusable (including null)
      registrationStep: { [Op.ne]: 'completed' }
    }
  });

  if (user && user.registrationStep === 'completed') {
    return next(new APIError(MESSAGES.USER_ALREADY_EXISTS, status.BAD_REQUEST));
  }

  // Generate 6-digit verification code
  const otp = await generateOtp(6);
  console.log({otp})
  if (user && user.registrationStep !== 'completed') {
    // Update existing incomplete registration
    await update(MODELS.USER, {
      phoneNumber,
      email: email.toLowerCase(),
      fullName,
      registrationStep: 'phone_verification'
    }, {
      where:
        { id: user.id }
    });
    if (fcm || uniqueId) {
      try {
        const existingFcm = await findOne(MODELS.FCM, { where: { userId: user.id } });
        if (existingFcm) {
          await update(MODELS.FCM, {
            ...(fcm && { fcm }),
            ...(uniqueId && { uniqueId }),
            userId: user.id,
          }, { where: { userId: user.id } });
        } else {
          await create(MODELS.FCM, {
            fcm: fcm || null,
            uniqueId: uniqueId || null,
            userId: user.id,
          });
        }
      } catch (e) {
        console.error('Non-blocking: failed to upsert FCM during signup (reuse path):', e?.message || e);
      }
    }

    // Update OTP and expiry
    await update(MODELS.FORGETPASSWORDTOKEN, {
      expiresIn: await generateExpiry(5),
      token: otp,
      userId: user.id,
    }, {
      where:
        { userId: user.id }
    });

    user = await findByPk(MODELS.USER, user.id);
  } else {
    // Create new user, but gracefully handle unique violations by reusing existing incomplete user
    try {
      user = await create(MODELS.USER, {
        phoneNumber,
        fullName,
        email: email.toLowerCase(),
        registrationStep: 'phone_verification',
        isPhoneVerified: false,
      });
      await create(MODELS.FORGETPASSWORDTOKEN, {
        userId: user.id,
        token: otp,
        expiresIn: await generateExpiry(5) // 5 minutes
      });
      if (fcm || uniqueId) {
        try {
          await create(MODELS.FCM, {
            fcm: fcm || null,
            uniqueId: uniqueId || null,
            userId: user.id
          });
        } catch (e) {
          console.error('Non-blocking: failed to create FCM during signup (new user):', e?.message || e);
        }
      }
    } catch (e) {
      // If a unique constraint is hit (phone/email), reuse the existing unverified user
      if (e && (e.name === 'SequelizeUniqueConstraintError' || e.original?.code === '23505')) {
        const existing = await findOne(MODELS.USER, {
          where: {
            [Op.or]: [
              { phoneNumber },
              { email: email.toLowerCase() },
            ],
            registrationStep: { [Op.ne]: 'completed' }
          }
        });
        if (existing) {
          // Update fields and OTP rows similar to the update path
          await update(MODELS.USER, {
            phoneNumber,
            email: email.toLowerCase(),
            fullName,
            registrationStep: 'phone_verification'
          }, { where: { id: existing.id } });

          if (fcm || uniqueId) {
            const existingFcm = await findOne(MODELS.FCM, { where: { userId: existing.id } });
            if (existingFcm) {
              await update(MODELS.FCM, {
                ...(fcm && { fcm }),
                ...(uniqueId && { uniqueId }),
                userId: existing.id,
              }, { where: { userId: existing.id } });
            } else {
              await create(MODELS.FCM, {
                fcm: fcm || null,
                uniqueId: uniqueId || null,
                userId: existing.id
              });
            }
          }

          const tokenRow = await findOne(MODELS.FORGETPASSWORDTOKEN, { where: { userId: existing.id } });
          if (tokenRow) {
            await update(MODELS.FORGETPASSWORDTOKEN, {
              expiresIn: await generateExpiry(5),
              token: otp,
              userId: existing.id,
            }, { where: { userId: existing.id } });
          } else {
            await create(MODELS.FORGETPASSWORDTOKEN, {
              userId: existing.id,
              token: otp,
              expiresIn: await generateExpiry(5)
            });
          }

          user = await findByPk(MODELS.USER, existing.id);
        } else {
          // If we couldn't find it, rethrow original error
          throw e;
        }
      } else {
        throw e;
      }
    }
  }
  // Send verification code via SMS and Email

  if (phoneNumber) {
    // const userFcm = await findOne(MODELS.FCM, { where: { userId: user.id } });
    // if (userFcm && userFcm.fcm) {
    //   try {
    //     await sendNotificationToDevice(
    //       userFcm.fcm,
    //       'Verification Code',
    //       `Your verification code is: ${otp}. Valid for 5 minutes.`
    //     );
    //   } catch (e) {
    //     // Already handled/logged inside sendNotificationToDevice; proceed without failing signup
    //   }
    // }
    console.log({phoneNumber})
    try {
      await sendSMS(phoneNumber, `Your verification code is: ${otp}. Valid for 5 minutes.`)
    } catch (smsError) {
      console.error('Failed to send SMS during signup:', smsError.message);
      // Log specific phone validation errors
      if (smsError.code === 'INVALID_PHONE_NUMBER') {
        console.error(`Invalid phone number provided: ${smsError.phoneNumber}`);
      }
      // Do not fail the signup process if SMS sending fails - user can still verify via email
    }
  }

  if (email) {
    try {
      await sendEmailSendGrid(email, 'Verification Code', `Your verification code is: ${otp}. Valid for 5 minutes.`)
    } catch (emailError) {
      console.error('Failed to send email during signup:', emailError.message, emailError?.response?.body || '');
      // Do not fail the signup process if email sending fails
    }
  }


  // Generate JWT token for verification step
  const jwtToken = jwt.sign(
    {
      id: user.id,
      phoneNumber: user.phoneNumber,
      step: 'phone_verification'
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
  );

  const userData = {
    id: user.id,
    phoneNumber: user.phoneNumber,
    registrationStep: user.registrationStep,
    token: jwtToken,
    expiresIn: `${process.env.JWT_EXPIRES_IN} hour`, // 5 minutes in seconds
    otp,
    fullName,
    email
  };

  APIresponse(res, MESSAGES.SUCCESS, userData);
});

/**
 * Step 2: Verify the code sent to phone and email
 */
const verifyOtp = catchAsync(async (req, res, next) => {
  const { otp } = req.body;
  const userId = req.user.id;
  const { error } = verifyOtpSchema.validate(req.body);
  if (error) {
    return next(new APIError(error.details[0].message, status.BAD_REQUEST));
  }
  const user = await findOne(MODELS.USER, {
    where: { id: userId },
    include: [
      {
        model: db[MODELS.FORGETPASSWORDTOKEN],
        as: 'forgetPasswordTokens'
      }
    ]
  });
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // Check if OTP has expired
  if (isOtpExpired(user.forgetPasswordTokens[0].expiresIn)) {
    return next(new APIError(MESSAGES.OTP_EXPIRED, status.BAD_REQUEST));
  }

  // Verify OTP
  if (user.forgetPasswordTokens[0].token !== otp) {
    return next(new APIError(MESSAGES.INVALID_OTP, status.BAD_REQUEST));
  }

  // Update user verification status
  await update(MODELS.USER, {
    isPhoneVerified: true,
    registrationStep: 'passcode_creation',
  }, { where: { id: userId } });

  await update(MODELS.FORGETPASSWORDTOKEN, {
    userId: user.id,
    token: null,
    expiresIn: null // 5 minutes
  }, { where: { userId: user.id } });

  // Generate new JWT token for passcode setup
  const jwtToken = jwt.sign(
    {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      step: 'passcode_creation'
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
  );

  const userData = {
    id: user.id,
    phoneNumber: user.phoneNumber,
    email: user.email,
    registrationStep: 'passcode_creation',
    isPhoneVerified: true,
    token: jwtToken
  };

  APIresponse(res, MESSAGES.SUCCESS, userData);
});

/**
 * Step 3: Set passcode to complete registration
 */
const setPasscode = catchAsync(async (req, res, next) => {
  const { passcode, confirmPasscode } = req.body;
  const userId = req.user.id;
  // Try to detect flow step from JWT payload in Authorization header in case passport doesn't include it
  let flowStep = req.user.step;
  if (!flowStep && req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      flowStep = decoded?.step;
    } catch (e) {
      // Ignore decode errors; fallback to normal signup flow checks
    }
  }
  const { error } = setPasscodeSchema.validate(req.body);
  if (error) {
    return next(new APIError(error.details[0].message, status.BAD_REQUEST));
  }
  // Check if passcodes match
  if (passcode !== confirmPasscode) {
    return next(new APIError(MESSAGES.PASSCODES_DO_NOT_MATCH, status.BAD_REQUEST));
  }

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // Two valid flows:
  // 1) Signup flow: step 'passcode_creation' after verify-otp
  // 2) Reset flow: step 'reset_passcode' after verifyResetOtp
  if (flowStep === 'reset_passcode') {
    // Allow passcode change even if registration is already completed
  } else {
    // Check if user is in correct step for signup flow
    // Enforce correct step and provide clearer guidance
    if (user.registrationStep === 'completed') {
      return next(
        new APIError(
          'Registration already completed. Use the forgot/reset passcode flow to change your passcode.',
          status.BAD_REQUEST
        )
      );
    }

    if (!user.isPhoneVerified) {
      return next(
        new APIError(
          `Invalid registration step: currently '${user.registrationStep}'. Complete OTP verification first.`,
          status.BAD_REQUEST
        )
      );
    }

    if (user.registrationStep !== 'passcode_creation') {
      return next(
        new APIError(
          `Invalid registration step: currently '${user.registrationStep}'.`,
          status.BAD_REQUEST
        )
      );
    }
  }

  // Hash passcode
  const hashedPasscode = await hashPassword(passcode);

  // Complete registration or update passcode in reset flow
  await update(MODELS.USER, {
    passcode: hashedPasscode,
    registrationStep: 'completed',
    lastLoginAt: new Date(),
    isActive: true,
    isPhoneVerified: true
  }, { where: { id: userId } });

  // Generate final JWT token
  const jwtToken = jwt.sign(
    {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      registrationStep: 'completed'
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
  );

  const updatedUser = await findByPk(MODELS.USER, userId);
  const userData = { ...updatedUser.get() };
  delete userData.passcode;
  userData.token = jwtToken;

  APIresponse(res, MESSAGES.REGISTRATION_COMPLETED_SUCCESSFULLY, userData);
});

/**
 * Resend verification code
 */
const resendOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // Check if user can receive OTP
  if (user.registrationStep === 'completed') {
    return next(new APIError(MESSAGES.USER_ALREADY_VERIFIED, status.BAD_REQUEST));
  }

  // Generate new OTP
  const otp = await generateOtp();
  const otpExpiry = await generateExpiry(5); // 5 minutes

  // Update user with new OTP
  await update(MODELS.USER, {
    otp,
    otpExpiry
  }, { where: { id: userId } });

  // Send new verification code
  const deliveryResults = { sms: false, email: false };
  
  if (phoneNumber) {
    try {
      await sendSMS(phoneNumber, `Your verification code is: ${otp}. Valid for 5 minutes.`);
      deliveryResults.sms = true;
    } catch (smsError) {
      console.error('Failed to send SMS for resend OTP:', smsError.message);
      if (smsError.code === 'INVALID_PHONE_NUMBER') {
        console.error(`Invalid phone number provided: ${smsError.phoneNumber}`);
      }
      // Continue with email if SMS fails
    }
  }

  if (email) {
    try {
      await sendEmailSendGrid(email, 'Verification Code', `Your verification code is: ${otp}. Valid for 5 minutes.`);
      deliveryResults.email = true;
    } catch (emailError) {
      console.error('Failed to send email during resend OTP:', emailError.message, emailError?.response?.body || '');
      // Do not fail the process if email sending fails
    }
  }
  
  // Check if at least one delivery method succeeded
  if (!deliveryResults.sms && !deliveryResults.email) {
    return next(new APIError(MESSAGES.NOTIFICATION_SEND_FAILED, status.INTERNAL_SERVER_ERROR));
  }

  APIresponse(res, MESSAGES.OTP_SENT_SUCCESSFULLY, {
    expiresIn: 300 // 5 minutes
  });
});

/**
 * User login with phone number and passcode
 */

const userlogin = catchAsync(async (req, res, next) => {
  const { phoneNumber, passcode, email, fcm, uniqueId } = req.body;
  
  // Input validation
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return next(new APIError(error.details[0].message, status.BAD_REQUEST));
  }

  try {
    // Normalize phone number if provided
    const normalizedPhoneNumber = phoneNumber ? phoneNumber.replace(/\D/g, '') : null;
    
    // First try exact match or email match
    let user = await findOne(MODELS.USER, {
      where: {
        [Op.or]: [
          ...(phoneNumber ? [
            { phoneNumber: normalizedPhoneNumber }
          ] : []),
          ...(email ? [
            { email: email.toLowerCase().trim() }
          ] : [])
        ],
        registrationStep: 'completed',
        isActive: true
      }
    });

    // If no exact match found and phone number was provided, try more flexible matching
    if (!user && phoneNumber) {
      // Get all users and filter in JavaScript for more flexible matching
      const users = await db[MODELS.USER].findAll({
        where: {
          phoneNumber: { [Op.ne]: null },
          registrationStep: 'completed',
          isActive: true
        }
        // Remove raw: true to get model instances
      });

      // Find user with matching phone number after normalizing
      const matchedUser = users.find(u => {
        if (!u.phoneNumber) return false;
        const storedNumber = u.phoneNumber.replace(/\D/g, '');
        return storedNumber.endsWith(normalizedPhoneNumber) || 
               storedNumber.includes(normalizedPhoneNumber);
      });
      
      // If we found a match, get the full user record as a model instance
      if (matchedUser) {
        user = await findOne(MODELS.USER, {
          where: { id: matchedUser.id }
        });
      }
    }

    if (!user) {
      return next(new APIError(MESSAGES.CREDENTIALS_NOT_VALID, status.BAD_REQUEST));
    }

    // Validate passcode
    const isPasscodeValid = await hashCompare(passcode, user.passcode);
    if (!isPasscodeValid) {
      return next(new APIError(MESSAGES.CREDENTIALS_NOT_VALID, status.BAD_REQUEST));
    }

    // Update last login time (fire and forget)
    update(MODELS.USER, 
      { lastLoginAt: new Date() }, 
      { where: { id: user.id } }
    ).catch(console.error);

    // Handle FCM token in background
    if (fcm) {
      handleFcmUpdate(user.id, fcm, uniqueId).catch(console.error);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        id: user.id,
        phoneNumber: user.phoneNumber,
        registrationStep: user.registrationStep
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
    );

    // Prepare response
    const userData = user.get();
    delete userData.passcode;
    userData.token = jwtToken;

    APIresponse(res, MESSAGES.LOGIN_SUCCESSFUL, userData);

  } catch (error) {
    console.error('Login error:', error);
    return next(new APIError(MESSAGES.INTERNAL_SERVER_ERROR, status.INTERNAL_SERVER_ERROR));
  }
});

// Helper function to handle FCM updates without blocking login
async function handleFcmUpdate(userId, fcm, uniqueId) {
  try {
    const fcmData = {
      userId,
      fcm,
      ...(uniqueId && { uniqueId })
    };

    // Check for existing FCM record
    const existingFcm = await findOne(MODELS.FCM, {
      where: {
        [Op.or]: [
          { userId, uniqueId: uniqueId || null },
          { userId, fcm }
        ].filter(Boolean)
      }
    });

    if (existingFcm) {
      await update(
        MODELS.FCM,
        { fcm, updatedAt: new Date() },
        { where: { id: existingFcm.id } }
      );
    } else {
      await create(MODELS.FCM, fcmData);
    }
  } catch (error) {
    console.error('FCM update failed:', error.message);
    // Don't rethrow, we don't want to fail login
  }
}
// const userlogin = catchAsync(async (req, res, next) => {
//   const { phoneNumber, passcode, email } = req.body;
//   const { error } = loginSchema.validate(req.body);
//   if (error) {
//     return next(new APIError(error.details[0].message, status.BAD_REQUEST));
//   }

//   const user = await findOne(MODELS.USER, {
//     where: {
//       ...(phoneNumber && { phoneNumber }),
//       ...(email && { email: email.toLowerCase() }),
//       registrationStep: 'completed',
//       isActive: true
//     }
//   });

//   if (!user) {
//     return next(new APIError(MESSAGES.CREDENTIALS_NOT_VALID, status.BAD_REQUEST));
//   }

//   // Validate passcode
//   const validatePasscode = await hashCompare(passcode, user.passcode);

//   if (!validatePasscode) {
//     return next(new APIError(MESSAGES.CREDENTIALS_NOT_VALID, status.BAD_REQUEST));
//   }

//   // Update last login
//   await update(MODELS.USER, {
//     lastLoginAt: new Date()
//   }, { where: { id: user.id } });

//   // Generate JWT token
//   const jwtToken = jwt.sign(
//     {
//       id: user.id,
//       phoneNumber: user.phoneNumber,
//       registrationStep: user.registrationStep
//     },
//     process.env.JWT_SECRET_KEY,
//     { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
//   );

//   const userData = { ...user.get() };
//   delete userData.passcode;
//   userData.token = jwtToken;
//   // Attach user's FCM details to login response
//   try {
//     const userFcm = await findOne(MODELS.FCM, { where: { userId: user.id } });
//     userData.fcm = userFcm?.fcm || null;
//     if (userFcm?.uniqueId) userData.uniqueId = userFcm.uniqueId;
//   } catch (e) {
//     // Do not block login response on FCM fetch issues
//     userData.fcm = null;
//   }

//   APIresponse(res, MESSAGES.LOGIN_SUCCESS, userData);
// });

/**
 * Forgot passcode - send OTP to registered phone/email
 */
const forgetPasscode = catchAsync(async (req, res, next) => {
  const { phoneNumber, email } = req.body;
  console.log('phoneNumber', phoneNumber);
  console.log('email', email);
  console.log(`Debug: Attempting to find user with phoneNumber: ${phoneNumber || 'undefined'}, email: ${email || 'undefined'}, registrationStep: 'completed', isActive: true`);
  // Build a dynamic identifier clause to avoid forcing email IS NULL when not provided
  const identifierOrClause = [
    phoneNumber ? { phoneNumber } : null,
    email ? { email: String(email).toLowerCase() } : null,
  ].filter(Boolean);

  const user = await findOne(MODELS.USER, {
    where: {
      ...(identifierOrClause.length ? { [Op.or]: identifierOrClause } : {}),
      // Allow both users who completed setup and those who are at passcode_creation (edge recovery)
      registrationStep: { [Op.in]: ['completed', 'passcode_creation'] },
      isActive: true,
    }
  });

  console.log(`Debug: User found: ${user ? 'yes' : 'no'}`);
  if (!user) {
    // Check if a user exists with the provided identifiers but registration is incomplete
    const maybeIncomplete = await findOne(MODELS.USER, {
      where: {
        ...(identifierOrClause.length ? { [Op.or]: identifierOrClause } : {}),
        registrationStep: { [Op.ne]: 'completed' }
      }
    });
    if (maybeIncomplete) {
      return next(new APIError('User exists but registration is incomplete. Please complete registration first.', status.BAD_REQUEST));
    }
    const triedEmail = Boolean(email);
    const triedPhone = Boolean(phoneNumber);
    const notFoundMsg = triedEmail
      ? MESSAGES.EMAIL_NOT_FOUND_SIGN_UP
      : triedPhone
        ? MESSAGES.MOBILE_NOT_FOUND_SIGN_UP
        : MESSAGES.USER_NOT_FOUND;

    return next(new APIError(notFoundMsg, status.NOT_FOUND));
  }

  // Generate OTP for passcode reset
  const otp = await generateOtp(6);
  // Upsert the token row for the user
  const existingTokenRow = await findOne(MODELS.FORGETPASSWORDTOKEN, { where: { userId: user.id } });
  if (existingTokenRow) {
    await update(MODELS.FORGETPASSWORDTOKEN, {
      token: otp,
      expiresIn: await generateExpiry(5) // 5 minutes
    }, { where: { userId: user.id } });
  } else {
    await create(MODELS.FORGETPASSWORDTOKEN, {
      userId: user.id,
      token: otp,
      expiresIn: await generateExpiry(5) // 5 minutes
    });
  }
  // Send OTP
  const resetResults = { sms: false, email: false };
  
  if (phoneNumber) {
    try {
  
     try {
       await sendSMS(phoneNumber, `Your verification code is: ${otp}. Valid for 5 minutes.`);
       resetResults.sms = true;
     } catch (error) {
      console.error('Failed to send SMS for password reset:', error.message);
     }
    } catch (smsError) {
      console.error('Failed to send SMS for password reset:', smsError.message);
      if (smsError.code === 'INVALID_PHONE_NUMBER') {
        console.error(`Invalid phone number provided: ${smsError.phoneNumber}`);
      }
      // Continue with email if SMS fails
    }
  }

  if (email) {
    try {
      // const userFcm = await findOne(MODELS.FCM, { where: { userId: user.id } });
      // sendNotificationToDevice(userFcm.fcm, 'Verification Code', `Your verification code is: ${otp}. Valid for 5 minutes.`, { type: 'PHONE_OTP', userId: String(user.id) });
      await sendEmailSendGrid(email, 'Verification Code', `Your verification code is: ${otp}. Valid for 5 minutes.`);
      resetResults.email = true;
    } catch (emailError) {
      console.error('Failed to send email during password reset:', emailError.message, emailError?.response?.body || '');
      // Do not fail the process if email sending fails
    }
  }
  
  // Ensure at least one delivery method succeeded
  if (!resetResults.sms && !resetResults.email) {
    console.error('Failed to send reset code via any channel');
    return next(new APIError(MESSAGES.NOTIFICATION_SEND_FAILED, status.INTERNAL_SERVER_ERROR));
  }

  // Generate token for reset process
  const jwtToken = jwt.sign(
    {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      step: 'passcode_reset'
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
  );

  APIresponse(res, MESSAGES.OTP_SENT_SUCCESSFULLY, {
    token: jwtToken,
    expiresIn: 600, // 10 minutes
    otp
  });
});

/**
 * Verify OTP for passcode reset
 */
const verifyResetOtp = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { otp } = req.body;

  const user = await findOne(MODELS.USER, {
    where: { id: userId },
    include: [
      {
        model: db[MODELS.FORGETPASSWORDTOKEN],
        as: 'forgetPasswordTokens'
      }
    ]
  });
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  const tokenRow = user.forgetPasswordTokens && user.forgetPasswordTokens[0];
  if (!tokenRow) {
    return next(new APIError(MESSAGES.NO_OTP_FOUND_OR_EXPIRED, status.BAD_REQUEST));
  }
  if (isOtpExpired(tokenRow.expiresIn)) {
    return next(new APIError(MESSAGES.OTP_EXPIRED, status.BAD_REQUEST));
  }
  if (String(tokenRow.token) !== String(otp)) {
    return next(new APIError(MESSAGES.INVALID_OTP, status.BAD_REQUEST));
  }
  // Clear OTP after verification
  await update(MODELS.FORGETPASSWORDTOKEN, {
    userId: user.id,
    token: null,
    expiresIn: null // 5 minutes
  }, { where: { userId: user.id } });
  // Generate token for passcode reset
  const jwtToken = jwt.sign(
    {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      step: 'reset_passcode'
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
  );

  APIresponse(res, MESSAGES.OTP_VERIFIED_SUCCESSFULLY, {
    token: jwtToken
  });
});

/**
 * Reset passcode after OTP verification
 */
//free h abhi yea
const resetPasscode = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { newPasscode, confirmPasscode } = req.body;

  if (newPasscode !== confirmPasscode) {
    return next(new APIError(MESSAGES.PASSCODES_DO_NOT_MATCH, status.BAD_REQUEST));
  }

  const user = await findOne(MODELS.USER, {
    where: { id: userId }
  });

  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }

  // Hash new passcode
  const hashedPasscode = await hashPassword(newPasscode);

  await update(MODELS.USER, {
    passcode: hashedPasscode
  }, { where: { id: userId } });

  APIresponse(res, MESSAGES.PASSCODE_RESET_SUCCESSFULLY);
});

/**
 * Change passcode (when user is logged in)
 */
const changePasscode = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  const user = await findOne(MODELS.USER, { where: { id: userId } });
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }
  // Validate old passcode
  const validatePasscode = await hashCompare(oldPassword, user.passcode);

  if (!validatePasscode) {
    return next(new APIError(MESSAGES.OLD_PASSCODE_INCORRECT, status.BAD_REQUEST));
  }

  // Hash new passcode
  const hashedPasscode = await hashPassword(newPassword);

  await update(MODELS.USER, {
    passcode: hashedPasscode
  }, { where: { id: userId } });

  APIresponse(res, MESSAGES.PASSCODE_CHANGED_SUCCESSFULLY);
});

/**
 * profile create (when user is logged in)
 */
const profile = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }
  user.fullName = req.body.fullName
  user.email = req.body.email
  user.dateOfBirth = req.body.dateOfBirth
  user.postalCode = req.body.postalCode
  user.streetAddress = req.body.streetAddress
 
  await user.save();
  const userData = { ...user.get() };
  delete userData.passcode; // Don't expose passcode in profile response

  APIresponse(res, MESSAGES.SUCCESS, userData);
});

/**
 * profile createFcm (when user is logged in)
*/
const createFcm = catchAsync(async (req, res, next) => {
  const { fcmToken, uniqueId } = req.body;

  if (!fcmToken) {
    return next(new APIError(MESSAGES.FCM_TOKEN_REQUIRED, status.BAD_REQUEST));
  }

  // Update user's FCM token
  await create(MODELS.FCM, {
    fcm: fcmToken,
    userId: null,
    uniqueId: uniqueId
  });

  APIresponse(res, MESSAGES.FCM_TOKEN_UPDATED_SUCCESSFULLY);
});

const updaterPlan = catchAsync(async (req, res, next) => {
  const { plan } = req.body;
  const userId = req.user.id;

  if (!plan || !['not_initiated', 'plus', 'base'].includes(plan)) {
    return next(new APIError('Invalid plan selected', status.BAD_REQUEST));
  }

  const user = await findByPk(MODELS.USER, userId);
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }
  let transferLimit = 0;
  if (plan === 'plus') {
    transferLimit = 0; // Example limit for Plus plan
  } else if (plan === 'base') {
    transferLimit = 1200; // Example limit for Base plan
  }
  await update(MODELS.USER, { plan, transferLimit }, { where: { id: userId } });


  APIresponse(res, MESSAGES.SUCCESS);
});

const getUser = catchAsync(async (req, res, next) => {
  const user = await findOne(MODELS.USER, {
    where: { id: req.user.id },
    attributes: ['id', 'phoneNumber', 'email', 'fullName', 'plan'],
    include: [
      {
        model: db[MODELS.KYC_REQUEST],
        as: 'kyc',
        attributes: ['postcode', 'address', 'city'] // Don't include callbackPayload
      }
    ]
  });
  
  if (!user) {
    return next(new APIError(MESSAGES.USER_NOT_FOUND, status.NOT_FOUND));
  }
  
  const userData = { ...user.get() };
  
  // Append selected KYC fields to the response
  if (user.kyc) {
    // Start with values stored directly in KYC table
    userData.postcode = user.kyc.postcode || null;
    userData.address = user.kyc.address || null;
    userData.city = user.kyc.city || null;

    // Load the latest KYC payload for enriched mapping and fallbacks
    const kycWithPayload = await findOne(MODELS.KYC_REQUEST, {
      where: { userId: req.user.id },
      attributes: ['callbackPayload'],
      order: [['createdAt', 'DESC']],
    });

    const payload = kycWithPayload?.callbackPayload || {};
    const proof = payload?.additional_data?.document?.proof || {};
    const geo = payload?.info?.geolocation || payload?.geolocation || {};

    // DOB mapping
    if (userData.dob === undefined) {
      userData.dob = proof?.dob || null;
    }

    // Full name preference for plus plan
    if (userData.plan === 'plus') {
      const fullNameFromKyc = payload?.verification_data?.document?.name?.full_name
        || proof?.full_name
        || (proof?.first_name || proof?.last_name ? `${proof?.first_name || ''} ${proof?.last_name || ''}`.trim() : '');
      if (fullNameFromKyc && fullNameFromKyc.trim()) {
        userData.fullName = fullNameFromKyc.trim();
      }
    }

    // Address and postcode fallbacks
    if (!userData.address && proof?.address) {
      userData.address = proof.address;
    }
    if (!userData.postcode) {
      userData.postcode = extractPostalCode(proof?.address) || geo?.postal_code || null;
    }
    if (!userData.city && geo?.city) {
      userData.city = geo.city;
    }

    // Optional additional fields for convenience in client (non-breaking)
    // These are derived but won't overwrite existing top-level schema fields
    // unless they don't exist yet.
    if (userData.nationality === undefined) {
      userData.nationality = proof?.country_code || proof?.document_country_code || null;
    }
    if (userData.gender === undefined && proof?.gender) {
      const g = String(proof.gender).toUpperCase();
      userData.gender = g === 'M' || g === 'MALE' ? 'male' : (g === 'F' || g === 'FEMALE' ? 'female' : null);
    }
  }
  
  APIresponse(res, MESSAGES.SUCCESS, userData);
});

// Controller for Google OAuth callback
const googleAuthCallback = catchAsync(async (req, res, next) => {
  // req.user is set by passport
  const user = req.user;
  if (!user) {
    return next(new APIError(MESSAGES.CREDENTIALS_NOT_VALID, status.BAD_REQUEST));
  }
  // Generate JWT token
  const jwtToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      registrationStep: user.registrationStep,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: `${process.env.JWT_EXPIRES_IN} hour` }
  );
  const userData = { ...user.get ? user.get() : user };
  delete userData.passcode;
  userData.token = jwtToken;
  APIresponse(res, MESSAGES.LOGIN_SUCCESS, userData);
});

module.exports = {
  signup,
  verifyOtp,
  setPasscode,
  resendOtp,
  userlogin,
  forgetPasscode,
  verifyResetOtp,
  resetPasscode,
  changePasscode,
  profile,
  createFcm,
  updaterPlan,
  getUser,
  googleAuthCallback,
  socialSignIn,
  checkSocialUser,
  sendSocialPhoneOtp,
  verifySocialPhoneOtp,
  requestUpdateContactOtp,
  verifyUpdateContactOtp,
  requestUpdateEmailNameOtp,
  verifyUpdateEmailNameOtp
};
