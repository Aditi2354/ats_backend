import pkg from "pg";
const { Pool } = pkg;

import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(".env"),
  override: true
});

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,

  ssl: {
    rejectUnauthorized: false
  }
});

async function createSchema() {
  try {
    console.log("Connecting to Render PostgreSQL...");

    const test = await pool.query(
      "SELECT current_database(), current_user"
    );

    console.log("Connected:", test.rows[0]);

    console.log("Creating tables...");

    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        location VARCHAR(255) DEFAULT 'India',
        description TEXT,
        experience_level VARCHAR(50) DEFAULT 'fresher',
        salary VARCHAR(255),
        apply_link TEXT,
        posted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(title, company)
      );

      CREATE TABLE IF NOT EXISTS job_requirements (
        id SERIAL PRIMARY KEY,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        requirement VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS skills (
        id SERIAL PRIMARY KEY,
        skill_name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS resumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        experience VARCHAR(50),
        summary TEXT,
        raw_text TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS resume_skills (
        id SERIAL PRIMARY KEY,
        resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
        skill_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS job_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        match_percentage FLOAT,
        match_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);

      CREATE INDEX IF NOT EXISTS idx_jobs_company
      ON jobs(company);

      CREATE INDEX IF NOT EXISTS idx_jobs_experience_level
      ON jobs(experience_level);

      CREATE INDEX IF NOT EXISTS idx_job_requirements_job_id
      ON job_requirements(job_id);

      CREATE INDEX IF NOT EXISTS idx_resumes_user_id
      ON resumes(user_id);

      CREATE INDEX IF NOT EXISTS idx_resume_skills_resume_id
      ON resume_skills(resume_id);

      CREATE INDEX IF NOT EXISTS idx_job_matches_resume_id
      ON job_matches(resume_id);

      CREATE INDEX IF NOT EXISTS idx_job_matches_job_id
      ON job_matches(job_id);
    `);

    console.log("✅ Complete schema created successfully");

  } catch (error) {
    console.error("❌ Schema creation failed:", error);
  } finally {
    await pool.end();
  }
}

createSchema();