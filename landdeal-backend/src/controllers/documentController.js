const db = require('../config/db');

// @desc    Upload documents and optionally finalize property creation
// @route   POST /api/properties/documents
exports.uploadDocuments = async (req, res, next) => {
  try {
const propertyId = req.body.property_id;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID is required to attach documents.'
      });
    }

    const files = req.files || {};

    const deedPath = files.deed ? files.deed[0].path : null;
    const taxReceiptPath = files.taxReceipt ? files.taxReceipt[0].path : null;
    const nationalIdPath = files.nationalId ? files.nationalId[0].path : null;
    const mutationCertPath = files.mutationCert ? files.mutationCert[0].path : null;
    const recentSurveyPath = files.recentSurvey ? files.recentSurvey[0].path : null;
    
    // Process multiple land images into a JSON array of paths
    const landImagesPaths = files.landImages 
      ? JSON.stringify(files.landImages.map(file => file.path))
      : JSON.stringify([]);

    const query = `
      INSERT INTO property_documents 
      (property_id, deed_path, tax_receipt_path, national_id_path, mutation_cert_path, recent_survey_path, land_images)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      propertyId,
      deedPath,
      taxReceiptPath,
      nationalIdPath,
      mutationCertPath,
      recentSurveyPath,
      landImagesPaths
    ];

    const [result] = await db.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Documents uploaded successfully!',
      documentId: result.insertId,
      propertyId
    });
  } catch (error) {
    next(error);
  }
};