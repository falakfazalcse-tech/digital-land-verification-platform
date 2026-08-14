const express = require('express');
const router = express.Router();
const uploadPropertyDocs = require('../middlewares/upload');
const verifyToken = require('../middlewares/authMiddleware');

const { uploadDocuments } = require('../controllers/documentController');
const { 
  createProperty, 
  getAllProperties, 
  getApprovedProperties,
  getPropertyById, 
  deleteProperty,
  updatePropertyStatus,
  getMetrics
} = require('../controllers/propertyController');

router.route('/')
  .get(getAllProperties)// This route will fetch only APPROVED properties           
  .post(verifyToken, createProperty);

router.get('/metrics', getMetrics);
router.get('/approved', getApprovedProperties);

router.get('/:id', getPropertyById);
router.patch('/:id/status', verifyToken, updatePropertyStatus); 

// Documents Upload Route
router.post('/documents', uploadPropertyDocs, uploadDocuments);

module.exports = router;