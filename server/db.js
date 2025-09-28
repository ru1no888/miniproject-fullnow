require('dotenv').config();
const mysql = require('mysql2/promise');

// ใช้ createPool ดีกว่า createConnection สำหรับเว็บแอปพลิเคชัน
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log("Database connection pool created.");

module.exports = pool;