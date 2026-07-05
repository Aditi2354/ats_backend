/**
 * Live Jobs Module
 * Fetches real-time fresher and internship job listings in India
 * using Google Jobs API via SerpAPI.
 */

import express from 'express';
import { getJson } from 'serpapi';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { extractSkillsFromText } from '../utils/skillExtractor.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

/* ---------------------------------------
   LOAD ENVIRONMENT VARIABLES
--------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// liveJobs.js -> backend/src/routes/
// .env       -> backend/.env
const envPath = path.join(__dirname, '../../.env');

const envResult = dotenv.config({
    path: envPath
});

if (envResult.error) {
    console.error('❌ Could not load backend/.env:', envResult.error.message);
}

console.log('🔐 Live Jobs ENV status:', {
    serpApiKeyLoaded: Boolean(process.env.SERPAPI_KEY)
});

const router = express.Router();

/* ---------------------------------------
   HELPER: SHUFFLE JOBS
--------------------------------------- */

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

/* ---------------------------------------
   HELPER: LOCAL DATABASE FALLBACK
--------------------------------------- */

async function getLocalFallbackJobs(query) {
    try {
        const { getAllJobs } = await import('../utils/database.js');

        // IMPORTANT: getAllJobs() is async
        const jobs = await getAllJobs();

        if (!Array.isArray(jobs)) {
            console.warn('⚠️ getAllJobs() did not return an array');
            return [];
        }

        const normalizedQuery = String(query || '')
            .trim()
            .toLowerCase();

        // If query is empty, return all local jobs
        if (!normalizedQuery) {
            return jobs;
        }

        return jobs.filter((job) => {
            const searchableText = [
                job?.title,
                job?.company,
                job?.location,
                job?.description,
                job?.experience_level
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(normalizedQuery);
        });

    } catch (error) {
        console.error(
            '❌ Local fallback jobs error:',
            error.message
        );

        return [];
    }
}

/* ---------------------------------------
   GET /api/live-jobs
--------------------------------------- */
console.log({
  serpLoaded: !!process.env.SERPAPI_KEY,
  first10: process.env.SERPAPI_KEY?.substring(0, 10)
});
/**
 * Fetch LIVE India fresher/internship jobs.
 * Protected route: JWT required.
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const query =
            typeof req.query.q === 'string' && req.query.q.trim()
                ? req.query.q.trim()
                : 'fresher developer';

        const serpApiKey = process.env.SERPAPI_KEY;

        /* ---------------------------------------
           FALLBACK WHEN SERPAPI KEY IS MISSING
        --------------------------------------- */

        if (!serpApiKey) {
            console.warn(
                '⚠️ SERPAPI_KEY not set; returning local jobs only'
            );

            const localJobs = await getLocalFallbackJobs(query);
            const now = Date.now();

            const formattedLocalJobs = localJobs.map((job, idx) => ({
                ...job,
                id: `local_${idx}_${now}`,
                source: 'local_database'
            }));

            return res.status(200).json({
                jobs: formattedLocalJobs,
                count: formattedLocalJobs.length,
                source: 'local_fallback',
                location: 'India',
                message:
                    'SerpAPI key not configured; showing local jobs only'
            });
        }

        /* ---------------------------------------
           SERPAPI SEARCH QUERIES
        --------------------------------------- */

        const searchVariations = [
            `${query} fresher internship India`,
            `${query} intern entry level India`,
            `internship ${query} India`,
            `fresher ${query} job India`,
            `junior ${query} India`,
            `${query} 0-1 year India`
        ];

        const allJobs = [];
        const seenJobIds = new Set();

        let serpError = null;

        /* ---------------------------------------
           PARALLEL SERPAPI REQUESTS
        --------------------------------------- */

        const requests = searchVariations.map(
            async (searchQuery, idx) => {
                try {
                    const response = await getJson({
                        engine: 'google_jobs',
                        q: searchQuery,
                        location: 'India',
                        api_key: serpApiKey
                    });

                    if (response?.error) {
                        console.warn(
                            `⚠️ SerpAPI error for search ${idx + 1}:`,
                            response.error
                        );

                        if (!serpError) {
                            serpError = response.error;
                        }

                        return;
                    }

                    const jobsResults = Array.isArray(
                        response?.jobs_results
                    )
                        ? response.jobs_results
                        : [];

                    for (const job of jobsResults) {
                        const uniqueId = [
                            job?.title || '',
                            job?.company_name || '',
                            job?.location || ''
                        ]
                            .join('_')
                            .toLowerCase();

                        if (!seenJobIds.has(uniqueId)) {
                            seenJobIds.add(uniqueId);
                            allJobs.push(job);
                        }
                    }

                } catch (error) {
                    const message =
                        error?.message || String(error);

                    console.warn(
                        `⚠️ Search variation ${idx + 1}/${searchVariations.length} failed: "${searchQuery}"`
                    );

                    console.warn(`   ${message}`);

                    if (!serpError) {
                        serpError = message;
                    }
                }
            }
        );

        /* ---------------------------------------
           WAIT FOR REQUESTS WITH TIMEOUT
        --------------------------------------- */

        try {
            await Promise.race([
                Promise.all(requests),

                new Promise((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    'SerpAPI request timeout'
                                )
                            ),
                        15000
                    )
                )
            ]);

        } catch (error) {
            console.warn(
                '⚠️ Some SerpAPI requests timed out; returning partial results'
            );

            if (!serpError) {
                serpError = error.message;
            }
        }

        /* ---------------------------------------
           NO EXTERNAL JOBS FOUND
           TRY LOCAL DATABASE FALLBACK
        --------------------------------------- */

        if (allJobs.length === 0) {
            console.warn(
                '⚠️ No live jobs returned; trying local database fallback'
            );

            const localJobs = await getLocalFallbackJobs(query);
            const now = Date.now();

            const formattedLocalJobs = localJobs.map(
                (job, idx) => ({
                    ...job,
                    id: `local_${idx}_${now}`,
                    source: 'local_database'
                })
            );

            let message =
                'No live fresher/internship jobs found';

            if (serpError) {
                message += ` (API error: ${serpError})`;
            }

            return res.status(200).json({
                jobs: formattedLocalJobs,
                count: formattedLocalJobs.length,
                source:
                    formattedLocalJobs.length > 0
                        ? 'local_fallback'
                        : 'no_results',
                location: 'India',
                message
            });
        }

        /* ---------------------------------------
           FILTER FRESHER / INTERNSHIP JOBS
        --------------------------------------- */

        const liveJobs = allJobs
            .filter((job) => {
                const jobText = [
                    job?.title,
                    job?.description
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return (
                    jobText.includes('fresher') ||
                    jobText.includes('intern') ||
                    jobText.includes('entry') ||
                    jobText.includes('graduate') ||
                    jobText.includes('trainee') ||
                    jobText.includes('0-1 year') ||
                    jobText.includes('0-2 year') ||
                    jobText.includes('campus') ||
                    jobText.includes('training') ||
                    jobText.includes('junior')
                );
            })
            .slice(0, 40)
            .map((job) => {
                const description =
                    job?.description || '';

                return {
                    title:
                        job?.title || 'Job Title',

                    company:
                        job?.company_name || 'Company',

                    location:
                        job?.location || 'India',

                    description,

                    requirements:
                        extractSkillsFromText(description),

                    experience_level: 'fresher',

                    salary:
                        job?.salary_range ||
                        job?.detected_extensions?.salary ||
                        'Stipend/Salary TBD',

                    posted_date:
                        new Date().toISOString(),

                    apply_link:
                        job?.apply_options?.[0]?.link ||
                        job?.job_link ||
                        '#',

                    source: 'google_jobs_india'
                };
            });

        /* ---------------------------------------
           IF STRICT FILTER REMOVES EVERYTHING
        --------------------------------------- */

        if (liveJobs.length === 0) {
            console.warn(
                '⚠️ Jobs received from SerpAPI, but none matched fresher filters'
            );

            return res.status(200).json({
                jobs: [],
                count: 0,
                source:
                    'Google Jobs API - India Fresher/Internship',
                location: 'India',
                message:
                    'Live jobs were found, but none matched fresher/internship filters'
            });
        }

        /* ---------------------------------------
           RANDOMIZE AND REFRESH IDS
        --------------------------------------- */

        const now = Date.now();

        const randomized = shuffle(liveJobs).map(
            (job, index) => ({
                ...job,
                id: `live_${index}_${now}`,
                posted_date:
                    new Date(now).toISOString()
            })
        );

        console.log(
            `✅ Returning ${randomized.length} live fresher/internship jobs for query: "${query}"`
        );

        /* ---------------------------------------
           FINAL RESPONSE
        --------------------------------------- */

        const payload = {
            jobs: randomized,
            count: randomized.length,
            source:
                'Google Jobs API - India Fresher/Internship',
            location: 'India'
        };

        if (serpError) {
            payload.message =
                `Partial results: ${serpError}`;
        }

        return res.status(200).json(payload);

    } catch (error) {
        console.error(
            '❌ Live Jobs Error:',
            error
        );

        return res.status(500).json({
            error: 'Could not fetch live jobs',
            details:
                error?.message ||
                'Unknown server error'
        });
    }
});

export default router;