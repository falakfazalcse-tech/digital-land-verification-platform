const express = require('express');
const router = express.Router();
const uploadPropertyDocs = require('../middlewares/upload');
const { uploadDocuments } = require('../controllers/documentController');
const { createProperty, getAllProperties, getPropertyById } = require('../controllers/propertyController');

// Properties Routes
router.route('/')
  .get(getAllProperties)
  .post(createProperty);

// Documents Upload Route
router.post('/documents', uploadPropertyDocs, uploadDocuments);

router.route('/:id')
  .get(getPropertyById);

module.exports = router;