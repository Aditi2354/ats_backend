/*This module handles user authentication using Node.js and Express. 
--It provides signup and login API routes where users can register and access their accounts securely. 
--Passwords are encrypted using bcrypt, and after successful authentication a JWT (JSON Web Token) is generated for secure user sessions. 
--The token is stored in a secure HTTP-only cookie so the system can verify the user in future requests. */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { addUser, findUserByEmail } from '../utils/database.js';

import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/auth/me
 * Verify token and return user data
 */
router.get('/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// signup route
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }
        const existing = await findUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const hashed = await bcrypt.hash(password, 10);
        const user = await addUser({ name, email, password: hashed });
        
        const secret = process.env.JWT_SECRET || 'supersecretkey';
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: '1d' });
        
        // set cookie for convenience
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 3600 * 1000 });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        console.error('Signup error', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const secret = process.env.JWT_SECRET || 'supersecretkey';
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, { expiresIn: '1d' });
        
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 3600 * 1000 });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        console.error('Login error', err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
