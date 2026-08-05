const db = require('../config/db');

// @desc    Get all land properties (with optional search/filtering)
// @route   GET /api/properties
exports.getAllProperties = async (req, res, next) => {
  try {
    const { district, landType, search } = req.query;
    let query = 'SELECT * FROM properties WHERE 1=1';
    const queryParams = [];

    if (district) {
      query += ' AND district = ?';
      queryParams.push(district);
    }

    if (landType) {
      query += ' AND land_type = ?';
      queryParams.push(landType);
    }

    if (search) {
      query += ' AND (land_title LIKE ? OR mouza LIKE ? OR khatian_no LIKE ? OR dag_no LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single land property by ID
// @route   GET /api/properties/:id
exports.getPropertyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM properties WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Land property not found' });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new land property (From Step 1/Step 3 Submission)
// @route   POST /api/properties
exports.createProperty = async (req, res, next) => {
  try {
    const {
 title,
 district,
 upazila,
 mouza,
 khatian_no,
 dag_no,
 area,
 land_type,
 description
}=req.body;

    // Server-side validation
    if (!title || !district || !upazila || !mouza || !khatian_no || !dag_no || !area || !land_type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (title, location, Khatian/Dag Nos., area, and type).'
      });
    }

    const query = `
      INSERT INTO properties 
      (land_title, district, upazila, mouza, khatian_no, dag_no, area, land_type, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values=[
 title,
 district,
 upazila,
 mouza,
 khatian_no,
 dag_no,
 area,
 land_type,
 description || null
];

    const [result] = await db.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Land property registered successfully!',
      propertyId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
exports.deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM properties WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.status(200).json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    next(error);
  }
};