const { signup,
  verifyOtp,
  setPasscode,
  resendOtp,
  userlogin,
  forgetPasscode,
  verifyResetOtp,
  resetPasscode,
  changePasscode,
  profile,
  updaterPlan,
  getUser,
  socialSignIn,
  sendSocialPhoneOtp,
  verifySocialPhoneOtp,
  requestUpdateContactOtp,
  verifyUpdateContactOtp,
  requestUpdateEmailNameOtp,
  verifyUpdateEmailNameOtp,
  checkSocialUser
} = require('../controllers/user');
const { authJwt } = require('../middlewares/authJwt');

module.exports = (router) => {
  // Step 1: Initiate signup with phone and email
  router.post('/signup', signup); 
  router.get('/user', authJwt, getUser);

  // Step 2: Verify OTP sent to phone and email
  router.post('/verify-otp', authJwt, verifyOtp);

  // Step 3: Set passcode to complete registration
  router.post('/set-passcode', authJwt, setPasscode);

  // update user plan
  router.post('/user/plan', authJwt, updaterPlan);

  // Get user profile
  router.post('/profile', authJwt, profile);

  // Resend verification OTP
  router.post('/resend-otp', authJwt, resendOtp);

  // Login with phone number and passcode
  router.post('/login', userlogin);

  // Social login
  router.post('/social-signin', socialSignIn);

  // Social: phone verification
  router.post('/social/send-phone-otp', authJwt, sendSocialPhoneOtp);
  router.post('/social/verify-phone-otp', authJwt, verifySocialPhoneOtp);

  // Forgot passcode flow
  router.post('/forgotPasscode', forgetPasscode);
  router.post('/verifyResetOtp', authJwt, verifyResetOtp);
  router.post('/resetPasscode', authJwt, resetPasscode);

  // Change passcode (authJwtd user)
  router.post('/change-passcode', authJwt, changePasscode);

  // update user contact
  router.post('/update-contact', authJwt, requestUpdateContactOtp);
  router.post('/verify-update-contact', authJwt, verifyUpdateContactOtp);

  // update email + fullName with OTP to new email
  router.post('/update-email-name', authJwt, requestUpdateEmailNameOtp);
  router.post('/verify-update-email-name', authJwt, verifyUpdateEmailNameOtp);

  // check social user
  router.post('/check-social-user', checkSocialUser);
};
