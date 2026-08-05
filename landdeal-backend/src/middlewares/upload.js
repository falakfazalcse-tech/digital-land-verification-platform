const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File Filter (PDF, PNG, JPG, JPEG)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName && mimeType) {
    return cb(null, true);
  }
  cb(new Error('Only PDF, JPG, PNG files are allowed!'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: fileFilter
});

// Define named fields based on Step 2 Frontend UI
const uploadPropertyDocs = upload.fields([
  { name: 'deed', maxCount: 1 },
  { name: 'taxReceipt', maxCount: 1 },
  { name: 'nationalId', maxCount: 1 },
  { name: 'mutationCert', maxCount: 1 },
  { name: 'recentSurvey', maxCount: 1 },
  { name: 'landImages', maxCount: 10 }
]);

module.exports = uploadPropertyDocs;