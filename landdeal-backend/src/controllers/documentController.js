const db = require('../config/db');

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

    const deedPath = files.deed ? files.deed[0].filename : null;
    const taxReceiptPath = files.taxReceipt ? files.taxReceipt[0].filename : null;
    const nationalIdPath = files.nationalId ? files.nationalId[0].filename : null;
    const mutationCertPath = files.mutationCert ? files.mutationCert[0].filename : null;
    const mouzaMapPath = files.mouzaMap ? files.mouzaMap[0].filename : null;

    // Process multiple land images into a JSON array of paths
    const landImagesPaths = files.landImages 
      ? JSON.stringify(files.landImages.map(file => file.filename))
      : JSON.stringify([]);

    const query = `
      INSERT INTO property_documents 
      (property_id, deed_path, tax_receipt_path, national_id_path, mutation_cert_path, mouza_map_path, land_images)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      propertyId,
      deedPath,
      taxReceiptPath,
      nationalIdPath,
      mutationCertPath,
      mouzaMapPath,
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