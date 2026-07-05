/**
 * This module manages job-related operations using Express routes. 
 * It allows the system to retrieve all available jobs, add new job postings, and delete existing jobs from the database. 
 * The API validates required fields like job title and company, processes job details such as requirements and salary, 
 and returns structured job data to the frontend for display.
 * Job Management Routes
 * Handles job CRUD operations
 */
import express from 'express';
import { getAllJobs, addJob, deleteJob } from '../utils/database.js';

import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/jobs
 * Get all jobs
 */
router.get('/', async (req, res) => {
    try {
        const jobs = await getAllJobs();
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/jobs
 * Add a new job
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, company, location, description, requirements, experience_level, salary, apply_link } = req.body;
        
        if (!title || !company) {
            return res.status(400).json({ error: "Title and company are required" });
        }

        const newJob = await addJob({
            title,
            company,
            location: location || 'India',
            description: description || '',
            requirements: Array.isArray(requirements) ? requirements : (requirements || '').split(',').map(s => s.trim()),
            experience_level: experience_level || 'fresher',
            salary: salary || 'Not specified',
            apply_link: apply_link || '#'
        });

        res.status(201).json({ success: true, job: newJob });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/jobs/:id
 * Delete a job
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await deleteJob(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
