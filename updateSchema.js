import pkg from 'pg';
const { Pool } = pkg;

import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

const result = dotenv.config({
    path: envPath,
    override: true
});

console.log('ENV PATH:', envPath);
console.log('DOTENV ERROR:', result.error);
console.log('LOADED KEYS:', Object.keys(result.parsed || {}));

console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('PASSWORD LOADED:', Boolean(process.env.DB_PASSWORD));

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

async function updateSchema() {
    try {
        console.log('Connecting to DB...');

        const test = await pool.query('SELECT current_database(), current_user');

        console.log('Connected:', test.rows[0]);

        await pool.query(
            'ALTER TABLE resumes ADD COLUMN IF NOT EXISTS live_matches_found INTEGER DEFAULT 0;'
        );

        await pool.query(
            'ALTER TABLE resumes ADD COLUMN IF NOT EXISTS local_matches_found INTEGER DEFAULT 0;'
        );

        console.log('Schema updated successfully');
    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        await pool.end();
    }
}

updateSchema();