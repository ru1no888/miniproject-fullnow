require('dotenv').config();
const express = require("express");
const cors = require('cors'); // <-- 1. เพิ่มบรรทัดนี้
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // <-- 2. เพิ่มบรรทัดนี้ เพื่ออนุญาต Cross-Origin Requests
app.use(express.json()); 
app.use(express.static('public')); 

// --- API Routes ---

// API 1: สำหรับสมัครสมาชิก (Register)
app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = "INSERT INTO users (username, password) VALUES (?, ?)";
        await db.query(query, [username, hashedPassword]);
        res.status(201).json({ message: "User registered successfully." });
    } catch (error) {
        console.error("Register error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Username already exists." });
        }
        res.status(500).json({ message: "Error registering user." });
    }
});

// API 2: สำหรับเข้าสู่ระบบ (Login)
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const query = "SELECT * FROM users WHERE username = ?";
        const [users] = await db.query(query, [username]);

        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ message: "Login successful.", token });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error." });
    }
});

// API 3: สำหรับดึงกระทู้ทั้งหมด (พร้อมชื่อผู้โพสต์)
app.get('/api/threads', async (req, res) => {
    try {
        const query = `
            SELECT threads.id, threads.title, threads.content, threads.created_at, users.username 
            FROM threads 
            JOIN users ON threads.user_id = users.id
            ORDER BY threads.created_at DESC
        `;
        const [threads] = await db.query(query);
        res.status(200).json(threads);
    } catch (err) {
        console.error("Fetch threads error:", err);
        res.status(500).json({ message: "Error retrieving threads" });
    }
});

// --- Middleware สำหรับตรวจสอบ Token ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// API 4: สำหรับสร้างกระทู้ใหม่ (ต้อง Login ก่อน)
app.post('/api/threads', authenticateToken, async (req, res) => {
    const { title, content } = req.body;
    const userId = req.user.userId;

    if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required." });
    }

    try {
        const query = 'INSERT INTO threads (title, content, user_id) VALUES (?, ?, ?)';
        const [result] = await db.query(query, [title, content, userId]);
        
        const newThreadQuery = `
            SELECT threads.id, threads.title, threads.content, threads.created_at, users.username 
            FROM threads
            JOIN users ON threads.user_id = users.id
            WHERE threads.id = ?
        `;
        const [newThread] = await db.query(newThreadQuery, [result.insertId]);

        res.status(201).json(newThread[0]);
    } catch (err) {
        console.error("Create thread error:", err);
        res.status(500).json({ message: 'Error creating thread' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});