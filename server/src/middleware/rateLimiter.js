const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      message: 'Too many login attempts from this IP, please try again after 15 minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 OTP requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      message: 'Too many password reset requests. Please wait a few minutes before trying again.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

module.exports = {
  loginLimiter,
  otpLimiter,
};
