const express = require('express');
const router = express.Router();
const uploadPropertyDocs = require('../middlewares/upload');
const verifyToken = require('../middlewares/authMiddleware');





const { uploadDocuments,getDocumentsByProperty } = require('../controllers/documentController');
const { 
  createProperty, 
  getAllProperties, 
  getApprovedProperties,
  getPropertyById, 
  updatePropertyStatus,
  getUserProperties,
  deleteProperty,
  getMetrics
} = require('../controllers/propertyController');

router.get('/my-properties', verifyToken, getUserProperties);
router.delete('/:id', verifyToken, deleteProperty);

router.route('/')
  .get(getAllProperties)      
  .post(verifyToken, createProperty);

router.get('/metrics', getMetrics);
router.get('/approved', getApprovedProperties);


router.get('/:id', getPropertyById);
router.patch('/:id/status', verifyToken, updatePropertyStatus); 

// Documents Upload Route
router.post('/documents', uploadPropertyDocs, uploadDocuments);
router.get('/properties/:propertyId/documents', uploadPropertyDocs,getDocumentsByProperty);


module.exports = router;