/**
 * Database Utility - PostgreSQL
 * Handles all database operations for users, jobs, and resume analysis
 */

import pkg from 'pg';
const { Pool } = pkg;

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// database.js is in backend/src/utils/
// .env is in backend/
dotenv.config({
    path: path.join(__dirname, '../../.env')
});

console.log('Database ENV loaded:', {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    passwordLoaded: Boolean(process.env.DB_PASSWORD)
});
// Create PostgreSQL connection pool
const isProductionDatabase =
    process.env.DB_HOST &&
    process.env.DB_HOST !== 'localhost';

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'ats_portal',

    ssl: isProductionDatabase
        ? {
            rejectUnauthorized: false
          }
        : false
});

// Test connection
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

/**
 * Get all users
 */
async function getAllUsers() {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        return result.rows;
    } catch (err) {
        console.error('Error fetching users:', err);
        return [];
    }
}

/**
 * Add a user
 */
async function addUser(userObj) {
    try {
        const { name, email, password } = userObj;
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
            [name, email, password]
        );
        return result.rows[0];
    } catch (err) {
        console.error('Error adding user:', err);
        throw err;
    }
}

/**
 * Find user by email
 */
async function findUserByEmail(email) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('Error finding user:', err);
        return null;
    }
}

/**
 * Get all jobs with requirements
 */
async function getAllJobs() {
    try {
        const result = await pool.query(
            `SELECT 
                j.id, j.title, j.company, j.location, j.description, 
                j.experience_level, j.salary, j.apply_link, j.posted_date,
                COALESCE(json_agg(json_build_object('id', jr.id, 'requirement', jr.requirement)) 
                    FILTER (WHERE jr.id IS NOT NULL), '[]'::json) as requirements
            FROM jobs j
            LEFT JOIN job_requirements jr ON j.id = jr.job_id
            GROUP BY j.id
            ORDER BY j.posted_date DESC`
        );
        return result.rows;
    } catch (err) {
        console.error('Error fetching jobs:', err);
        return [];
    }
}

/**
 * Add a new job with requirements
 */
async function addJob(jobData) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { title, company, location, description, requirements, experience_level, salary, apply_link } = jobData;
        
        // Insert job
        const jobResult = await client.query(
            `INSERT INTO jobs (title, company, location, description, experience_level, salary, apply_link) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, company, location || 'India', description || '', experience_level || 'fresher', salary || 'Not specified', apply_link || '#']
        );
        
        const jobId = jobResult.rows[0].id;
        
        // Insert requirements
        if (Array.isArray(requirements) && requirements.length > 0) {
            for (const req of requirements) {
                await client.query(
                    'INSERT INTO job_requirements (job_id, requirement) VALUES ($1, $2)',
                    [jobId, req]
                );
            }
        }
        
        await client.query('COMMIT');
        
        // Return job with requirements
        return {
            ...jobResult.rows[0],
            requirements: Array.isArray(requirements) ? requirements : []
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding job:', err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Delete a job
 */
async function deleteJob(jobId) {
    try {
        await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
        return true;
    } catch (err) {
        console.error('Error deleting job:', err);
        throw err;
    }
}

/**
 * Get all resumes with skills
 */
async function getAllResumes() {
    try {
        const result = await pool.query(
            `SELECT 
                r.id, r.user_id, r.filename, r.timestamp,
                COALESCE(json_agg(json_build_object('id', rs.id, 'skill_name', rs.skill_name, 'category', rs.category)) 
                    FILTER (WHERE rs.id IS NOT NULL), '[]'::json) as skills
            FROM resumes r
            LEFT JOIN resume_skills rs ON r.id = rs.resume_id
            GROUP BY r.id
            ORDER BY r.timestamp DESC`
        );
        return result.rows;
    } catch (err) {
        console.error('Error fetching resumes:', err);
        return [];
    }
}

/**
 * Save resume analysis
 */
async function saveResume(analysisData) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { user_id, filename, skills, categorized_skills, experience, summary, raw_text } = analysisData;
        
        // Insert resume with experience, summary, and raw text
        const resumeResult = await client.query(
            'INSERT INTO resumes (user_id, filename, experience, summary, raw_text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id || null, filename || 'resume.pdf', experience || 'no_experience', summary || '', raw_text || '']
        );
        
        const resumeId = resumeResult.rows[0].id;
        
        // Insert skills
        if (Array.isArray(skills) && skills.length > 0) {
            for (const skill of skills) {
                const category = extractCategoryForSkill(skill, categorized_skills);
                await client.query(
                    'INSERT INTO resume_skills (resume_id, skill_name, category) VALUES ($1, $2, $3)',
                    [resumeId, skill, category || null]
                );
            }
        }
        
        await client.query('COMMIT');
        
        return resumeResult.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving resume:', err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Helper function to extract category for a skill
 */
function extractCategoryForSkill(skill, categorizedSkills) {
    if (!categorizedSkills) return null;
    
    for (const [category, skillsList] of Object.entries(categorizedSkills)) {
        if (Array.isArray(skillsList) && skillsList.includes(skill)) {
            return category;
        }
    }
    return null;
}

/**
 * Insert or get live job (for external API jobs)
 * Returns the job UUID from database
 */
async function insertLiveJob(liveJobData) {
    try {
        // Remove the temporary 'live_X_timestamp' ID before storing
        const { title, company, location, description, requirements, experience_level, salary, posted_date, apply_link, source } = liveJobData;
        
        // Insert the job
        const result = await pool.query(
            `INSERT INTO jobs (title, company, location, description, experience_level, salary, apply_link, posted_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (title, company) DO UPDATE SET posted_date=EXCLUDED.posted_date 
             RETURNING id`,
            [title, company, location || 'India', description || '', experience_level || 'fresher', salary || 'TBD', apply_link || '#', posted_date || new Date()]
        );
        
        const jobId = result.rows[0].id;
        
        // Insert requirements
        if (Array.isArray(requirements) && requirements.length > 0) {
            for (const req of requirements) {
                await pool.query(
                    `INSERT INTO job_requirements (job_id, requirement) VALUES ($1, $2) 
                     ON CONFLICT DO NOTHING`,
                    [jobId, req]
                );
            }
        }
        
        return jobId;
    } catch (err) {
        console.error('Error inserting live job:', err);
        throw err;
    }
}

/**
 * Save job matches for resume
 */
async function saveJobMatches(resumeId, matches) {
    try {
        for (const match of matches) {
            // If job_id looks like a live job ID, insert it first and get UUID
            let jobId = match.job_id;
            if (typeof jobId === 'string' && jobId.startsWith('live_')) {
                // This shouldn't happen if resume.js calls insertLiveJob first, but fallback just in case
                console.warn('Unexpected live job ID format in saveJobMatches, skipping:', jobId);
                continue;
            }
            
            await pool.query(
                `INSERT INTO job_matches (resume_id, job_id, match_percentage, match_data) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [resumeId, jobId, match.match_percentage, JSON.stringify(match)]
            );
        }
        return true;
    } catch (err) {
        console.error('Error saving job matches:', err);
        throw err;
    }
}

/**
 * Get job matches for a resume
 */
async function getJobMatches(resumeId) {
    try {
        const result = await pool.query(
            `SELECT jm.*, j.title, j.company, j.location, j.salary
             FROM job_matches jm
             JOIN jobs j ON jm.job_id = j.id
             WHERE jm.resume_id = $1
             ORDER BY jm.match_percentage DESC`,
            [resumeId]
        );
        return result.rows;
    } catch (err) {
        console.error('Error fetching job matches:', err);
        return [];
    }
}

export {
    getAllJobs,
    addJob,
    deleteJob,
    saveResume,
    getAllResumes,
    getAllUsers,
    addUser,
    findUserByEmail,
    saveJobMatches,
    getJobMatches,
    insertLiveJob,
    pool
};
