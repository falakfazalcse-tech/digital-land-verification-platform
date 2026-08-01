// middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

module.exports = upload;

// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const upload = require('./middleware/upload');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define multipart fields expected from add_land2.html
const uploadFields = upload.fields([
  { name: 'deed_sales_deed', maxCount: 1 },
  { name: 'tax_receipt', maxCount: 1 },
  { name: 'national_id', maxCount: 1 },
  { name: 'mutation_certificate', maxCount: 1 },
  { name: 'recent_survey', maxCount: 1 },
  { name: 'land_images', maxCount: 10 }
]);

// POST route: Add Property
app.post('/api/properties', uploadFields, async (req, res) => {
  const connection = await db.getConnection();

  try {
    // 1. Start SQL Transaction
    await connection.beginTransaction();

    const {
      landTitle,
      district,
      upazila,
      mouza,
      khatianNo,
      dagNo,
      area,
      landType,
      description
    } = req.body;

    // 2. Insert into properties table
    const [propertyResult] = await connection.execute(
      `INSERT INTO properties 
       (title, district, upazila, mouza, khatian_no, dag_no, area, land_type, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        landTitle,
        district,
        upazila,
        mouza,
        khatianNo,
        dagNo,
        area,
        landType,
        description || ''
      ]
    );

    const propertyId = propertyResult.insertId;

    // 3. Process Single PDF Documents
    const docFields = ['deed_sales_deed', 'tax_receipt', 'national_id', 'mutation_certificate', 'recent_survey'];
    
    for (const field of docFields) {
      if (req.files && req.files[field]) {
        const file = req.files[field][0];
        await connection.execute(
          `INSERT INTO property_documents (property_id, document_type, file_path) VALUES (?, ?, ?)`,
          [propertyId, field, file.path]
        );
      }
    }

    // 4. Process Multiple Land Images
    if (req.files && req.files['land_images']) {
      for (const imageFile of req.files['land_images']) {
        await connection.execute(
          `INSERT INTO property_images (property_id, image_path) VALUES (?, ?)`,
          [propertyId, imageFile.path]
        );
      }
    }

    // 5. Commit Transaction
    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Property submitted successfully',
      propertyId: propertyId
    });

  } catch (error) {
    // Rollback on failure
    await connection.rollback();
    console.error('Error saving property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process property submission',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// GET route: Fetch Property Details for Preview or Listing
app.get('/api/properties/:id', async (req, res) => {
  try {
    const [properties] = await db.execute('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    
    if (properties.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const [documents] = await db.execute('SELECT document_type, file_path FROM property_documents WHERE property_id = ?', [req.params.id]);
    const [images] = await db.execute('SELECT image_path FROM property_images WHERE property_id = ?', [req.params.id]);

    res.json({
      success: true,
      data: {
        ...properties[0],
        documents,
        images
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});