const bcrypt = require('bcryptjs');

const generateOtp = () => {
  // Generate a random 6-digit string
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
};

const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(otp, salt);
};

const verifyOtpHash = async (otp, hashedOtp) => {
  return await bcrypt.compare(otp, hashedOtp);
};

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtpHash
};