const PropertyModel = require('../models/propertyModel');

exports.getApprovedProperties = async (req, res, next) => {
  try {
    const { district, landType, search } = req.query;

    // Delegates database operation to Model
    const properties = await PropertyModel.findApproved({ district, landType, search });

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    next(error);
  }
};
exports.getAllProperties = async (req, res, next) => {
  try {
    const { status, district, landType, search } = req.query;

    // Call Model with status filter
    const properties = await PropertyModel.findAll({ status, district, landType, search });

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserProperties = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user.id || req.user.userId) : null;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in token payload'
      });
    }

    const properties = await PropertyModel.findByUserId(userId);

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    next(error);
  }
};

exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await PropertyModel.findById(id);

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.status(200).json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createProperty = async (req, res, next) => {
  try {
    const {
      title, district, upazila, mouza, khatian_no,
      dag_no, area, land_type, price, negotiable
    } = req.body;

    const userId = req.user.id;
    const numericPrice = parseFloat(price);
    const isNegotiable = negotiable === 'Yes';

    if (!title || !district || !upazila || !mouza || !khatian_no || !dag_no || !area || !land_type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (title, location, Khatian/Dag Nos., area, and type).'
      });
    }

    const propertyId = await PropertyModel.create({
      title, district, upazila, mouza, khatian_no,
      dag_no, area, land_type, numericPrice, isNegotiable, userId
    });

    res.status(201).json({
      success: true,
      message: 'Land property registered successfully!',
      propertyId
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isDeleted = await PropertyModel.deleteById(id);

    if (!isDeleted) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.status(200).json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getMetrics = async (req, res) => {
  try {
    const metrics = await PropertyModel.getMetrics();
    res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updatePropertyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    if (!['APPROVED', 'REJECTED', 'PENDING', 'approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const normalizedStatus = status.toLowerCase();
    const isUpdated = await PropertyModel.updateStatus(id, normalizedStatus);

    if (!isUpdated) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Status updated successfully',
      status: normalizedStatus
    });
  } catch (error) {
    console.error('Database Update Error:', error);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
};