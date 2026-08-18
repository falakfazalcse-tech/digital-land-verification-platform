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
// Example in property.routes.js or propertyController.js
router.get('/my-properties', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [properties] = await db.query('SELECT * FROM properties WHERE user_id = ?', [userId]);

    res.status(200).json({
      success: true,
      data: properties
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', getPropertyById);
router.patch('/:id/status', verifyToken, updatePropertyStatus); 

// Documents Upload Route
router.post('/documents', uploadPropertyDocs, uploadDocuments);

module.exports = router;