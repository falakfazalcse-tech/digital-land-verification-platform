const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  ssl: {
    rejectUnauthorized: false // Aiven MySQL SSL কানেকশনের জন্য এটি অপরিহার্য
  },
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;