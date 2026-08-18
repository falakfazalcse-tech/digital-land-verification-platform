const db = require('../config/db');

class PropertyModel {
  // Fetch only APPROVED properties with filters
  static async findApproved({ district, landType, search }) {
    let query = `
      SELECT 
        p.*, 
        pd.land_images,
        u.full_name AS owner_name, 
        u.phone AS owner_phone 
      FROM properties p 
      LEFT JOIN property_documents pd ON p.id = pd.property_id
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE LOWER(p.status) = 'approved'`;
      
    const queryParams = [];

    if (district) {
      query += ' AND LOWER(p.district) = LOWER(?)';
      queryParams.push(district);
    }

    if (landType) {
      query += ' AND LOWER(p.land_type) = LOWER(?)';
      queryParams.push(landType);
    }

    if (search) {
      query += ' AND (p.land_title LIKE ? OR p.mouza LIKE ? OR p.khatian_no LIKE ? OR p.dag_no LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await db.query(query, queryParams);
    return rows;
  }

  
  static async findAll({ status, district, landType, search }) {
    let query = `
      SELECT 
        p.*, 
        pd.land_images,
        u.full_name AS owner_name, 
        u.phone AS owner_phone 
      FROM properties p 
      LEFT JOIN property_documents pd ON p.id = pd.property_id
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE 1=1`;
      
    const queryParams = [];

    // status 'all' না হলে কেবল নির্দিষ্ট status দিয়ে ফিল্টার করবে
    if (status && status.toLowerCase() !== 'all') {
      query += ' AND LOWER(p.status) = LOWER(?)';
      queryParams.push(status);
    }

    if (district) {
      query += ' AND LOWER(p.district) = LOWER(?)';
      queryParams.push(district);
    }

    if (landType) {
      query += ' AND LOWER(p.land_type) = LOWER(?)';
      queryParams.push(landType);
    }

    if (search) {
      query += ' AND (p.land_title LIKE ? OR u.full_name LIKE ? OR p.mouza LIKE ? OR p.khatian_no LIKE ? OR p.dag_no LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await db.query(query, queryParams);
    return rows;
  }

  // Fetch property by ID with documents and owner details
  static async findById(id) {
    const query = `
      SELECT 
        p.*, 
        pd.deed_path,
        pd.tax_receipt_path,
        pd.national_id_path,
        pd.mutation_cert_path,
        pd.mouza_map_path,
        pd.land_images,
        u.full_name AS owner_name, 
        u.email AS owner_email, 
        u.phone AS owner_phone, 
        u.created_at AS owner_created_at
      FROM properties p
      LEFT JOIN property_documents pd ON p.id = pd.property_id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0] || null;
  }

  // Fetch properties added by a specific logged-in user
static async findByUserId(userId) {
  const query = `
    SELECT 
      p.*, 
      pd.land_images,
      u.full_name AS owner_name, 
      u.phone AS owner_phone 
    FROM properties p 
    LEFT JOIN property_documents pd ON p.id = pd.property_id
    LEFT JOIN users u ON p.user_id = u.id 
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `;
  const [rows] = await db.query(query, [userId]);
  return rows;
}

  // Create a new property entry
  static async create(propertyData) {
    const query = `
      INSERT INTO properties 
      (land_title, district, upazila, mouza, khatian_no, dag_no, area, land_type, price, negotiable, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      propertyData.title,
      propertyData.district,
      propertyData.upazila,
      propertyData.mouza,
      propertyData.khatian_no,
      propertyData.dag_no,
      propertyData.area,
      propertyData.land_type,
      propertyData.numericPrice,
      propertyData.isNegotiable,
      propertyData.userId
    ];

    const [result] = await db.query(query, values);
    return result.insertId;
  }

  // Delete property
  static async deleteById(id) {
    const [result] = await db.query('DELETE FROM properties WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Get metrics
  static async getMetrics() {
    const [counts] = await db.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM properties
    `);
    return counts[0];
  }

  // Update status
  static async updateStatus(id, status) {
    const query = `UPDATE properties SET status = ? WHERE id = ?`;
    const [result] = await db.query(query, [status, id]);
    return result.affectedRows > 0;
  }
}

module.exports = PropertyModel;