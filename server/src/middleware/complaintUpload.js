const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const complaintsUploadDir = path.resolve(__dirname, '../../uploads/complaints');
if (!fs.existsSync(complaintsUploadDir)) {
  fs.mkdirSync(complaintsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, complaintsUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const rand = crypto.randomBytes(8).toString('hex');
    const safeName = `cmp-${Date.now()}-${rand}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are permitted.'), false);
  }
};

const uploadLimits = {
  fileSize: 5 * 1024 * 1024, // 5MB limit
};

const uploadComplaintPhotos = multer({
  storage,
  limits: { ...uploadLimits, files: 4 },
  fileFilter,
}).array('photos', 4);

const uploadAfterPhoto = multer({
  storage,
  limits: { ...uploadLimits, files: 1 },
  fileFilter,
}).single('afterPhoto');

module.exports = {
  uploadComplaintPhotos,
  uploadAfterPhoto,
  complaintsUploadDir,
};
