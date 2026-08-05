const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const propertyRoutes = require('./src/routes/propertyRoutes');

const app = express();

//for middleware
app.use(cors());
app.use(express.json());

// Routes

// Authentication
app.use('/api/auth', authRoutes);

// Property APIs
app.use('/api/properties', propertyRoutes);
app.use('/uploads', express.static('uploads'));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date()
  });
});

// // =========================
// // 404 Handler
// // =========================
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route not found'
//   });
// });

// // =========================
// // Error Handler
// // =========================
// app.use((err, req, res, next) => {
//   console.error(err);

//   res.status(err.statusCode || 500).json({
//     success: false,
//     message: err.message || 'Internal Server Error'
//   });
// });

// =========================
// Start Server
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 LandDeal API Server running on http://localhost:${PORT}`);
});