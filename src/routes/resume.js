/**
 --This module handles resume upload and analysis using Node.js and Express. 
 --It extracts text from the uploaded PDF resume, identifies the user’s skills, and categorizes them using a skill extraction system. 
 --The system then matches the detected skills with local jobs and live jobs from Google Jobs API (SerpAPI) to calculate job match percentages. 
 --Finally, it returns the best job matches and saves the resume analysis data for the user.
 * Resume Analysis Routes
 * Handles PDF upload and job matching
 */

import express from 'express';
import { PDFExtract } from 'pdf.js-extract';
import { getJson } from 'serpapi';
import jwt from 'jsonwebtoken';

import { extractSkills, categorizeSkills, extractSkillsFromText } from '../utils/skillExtractor.js';
import { calculateMatch } from '../utils/jobMatcher.js';
import { getAllJobs, saveResume } from '../utils/database.js';
import { addLiveMatchesCount } from '../utils/statsStore.js';

import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

const pdfExtract = new PDFExtract();

/**
 * POST /api/resume/analyze
 * Upload and analyze resume for job matches
 */
router.post('/analyze', authenticateToken, async (req, res) => {

    try {

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        /* =====================================
           Logged In User (from JWT)
        ===================================== */
        const userId = req.user.id;

        console.log("📄 Processing Resume...");

        pdfExtract.extractBuffer(req.file.buffer, {}, async (err, data) => {

            if (err) {
                return res.status(500).json({ error: "PDF Read Error" });
            }

            /* =====================================
               Extract Text
            ===================================== */

            const fullText = data.pages
                .map(p => p.content.map(i => i.str).join(' '))
                .join(' ');

            const userSkills = extractSkills(fullText);
            const categorizedSkills = categorizeSkills(userSkills);

            console.log("✅ Skills Detected:", userSkills.length);

            if (userSkills.length === 0) {
                return res.json({
                    user_skills: [],
                    categorized_skills: {},
                    local_matches: [],
                    live_matches: [],
                    message: "No skills found in resume."
                });
            }

            const topSkills = userSkills.slice(0, 4);

            const localJobs = await getAllJobs();

            /* =====================================
               LIVE JOB SEARCH (SerpAPI)
            ===================================== */

            let liveJobs = [];
            let serpError = null;

            const searchVariations = [
                `fresher ${topSkills.join(' ')} internship India`,
                `${topSkills[0]} intern entry level India`,
                `${topSkills[0]} graduate trainee India`,
                `internship ${topSkills[0]} ${topSkills[1]} India`,
                `${topSkills[1]} fresher job India`,
                `${topSkills[2] || 'developer'} internship India`,
                `fresher internship India ${topSkills[0]}`,
                `entry level ${topSkills[0]} India`,
                `junior ${topSkills[1]} India trainee`,
                `${topSkills[0]} ${topSkills[2]} fresher India`
            ];

            const seenJobIds = new Set();

            try {

                for (let idx = 0; idx < searchVariations.length; idx++) {

                    const searchQuery = searchVariations[idx];

                    try {

                        const liveResponse = await getJson({
                            engine: 'google_jobs',
                            q: searchQuery,
                            location: 'India',
                            api_key: process.env.SERPAPI_KEY,
                            num: 40
                        });

                        if (liveResponse?.error) {
                            serpError = liveResponse.error;
                            continue;
                        }

                        if (liveResponse.jobs_results) {

                            for (const job of liveResponse.jobs_results) {

                                const uniqueId =
                                    `${job.title}_${job.company_name}`.toLowerCase();

                                if (!seenJobIds.has(uniqueId)) {
                                    seenJobIds.add(uniqueId);
                                    liveJobs.push(job);
                                }

                            }

                        }

                        await new Promise(r => setTimeout(r, 200));

                    } catch (err) {

                        const errorMsg = err.message || err.toString();
                        console.warn(`Search failed: ${searchQuery}`);
                        console.warn(errorMsg);

                        if (!serpError) serpError = errorMsg;

                    }

                }

                if (liveJobs.length > 0) {

                    liveJobs = liveJobs
                        .filter(job => {

                            const text = (job.title + " " + job.description).toLowerCase();

                            return text.includes("fresher") ||
                                   text.includes("intern") ||
                                   text.includes("entry") ||
                                   text.includes("graduate") ||
                                   text.includes("trainee");

                        })
                        .slice(0, 40)
                        .map((job, idx) => {

                            const description = job.description || job.title || '';

                            const extractedSkills =
                                extractSkillsFromText(description);

                            const requirements =
                                extractedSkills.length > 0
                                    ? extractedSkills
                                    : ['JavaScript','Python','Java','Web Development'];

                            return {

                                id: `live_${idx}_${Date.now()}`,
                                title: job.title || "Job",
                                company: job.company_name || "Company",
                                location: job.location || "India",
                                description,
                                requirements,
                                experience_level: "fresher",
                                salary: job.salary_range || "TBD",
                                posted_date: new Date().toISOString(),
                                apply_link: job.apply_options?.[0]?.link || "#",
                                source: "google_jobs"

                            };

                        });

                }

                if (liveJobs.length === 0) {

                    console.warn("Using local fallback jobs");

                    liveJobs = localJobs.slice(0, 5);

                    liveJobs.fallback = true;

                }

            } catch (liveErr) {

                console.error("Live job fetch error:", liveErr.message);

            }

            /* =====================================
               LOCAL MATCHES
            ===================================== */

            const localMatches = localJobs.map(job => {

                const match = calculateMatch(userSkills, job.requirements);

                return {
                    ...job,
                    match_data: match,
                    match_percentage: match.percentage,
                    source: "local"
                };

            }).sort((a,b)=>b.match_percentage-a.match_percentage);

            /* =====================================
               LIVE MATCHES
            ===================================== */

            const liveMatches = liveJobs.map(job => {

                const match = calculateMatch(userSkills, job.requirements);

                return {
                    ...job,
                    match_data: match,
                    match_percentage: match.percentage,
                    source: "live"
                };

            }).sort((a,b)=>b.match_percentage-a.match_percentage);

            const allMatches = [...localMatches,...liveMatches]
                .sort((a,b)=>b.match_percentage-a.match_percentage);

            /* =====================================
               SAVE RESUME (IMPORTANT CHANGE)
            ===================================== */
            
            addLiveMatchesCount(liveMatches.length);

            const resumeData = await saveResume({

                user_id: userId,   // ⭐ THIS FIX ENABLES USER STATISTICS

                filename: req.file.originalname,

                skills: userSkills,

                categorized_skills: categorizedSkills,

                total_skills: userSkills.length,

                local_matches_found: localMatches.length,

                live_matches_found: liveMatches.length,

                raw_text: fullText.substring(0,5000),

                summary: fullText.substring(0,500),

                experience:
                    fullText.match(/experience|worked|position|role/i)
                    ? "has_experience"
                    : "no_experience"

            });

            // 🚫 DON'T SAVE JOB MATCHES - Calculate dynamically only
            // This prevents database bloat from accumulating matches
            console.log(`📊 Calculated ${allMatches.length} matches (NOT persisted)`);

            // Calculate average match percentage
            const averageMatch = allMatches.length > 0
                ? Math.round(allMatches.reduce((sum, m) => sum + m.match_percentage, 0) / allMatches.length)
                : 0;

            /* =====================================
               RESPONSE
            ===================================== */

            res.json({

                user_skills: userSkills,

                categorized_skills: categorizedSkills,

                local_matches: localMatches,

                live_matches: liveMatches,

                all_matches: allMatches,

                analysis: {

                    total_skills_found: userSkills.length,

                    local_jobs_matched: localMatches.length,

                    live_jobs_matched: liveMatches.length,

                    total_matched: allMatches.length,

                    best_match:
                        allMatches.length > 0
                        ? allMatches[0].match_percentage
                        : 0,

                    averageMatch: averageMatch

                }

            });

        });

    } catch (err) {

        console.error("Server Error:", err);

        res.status(500).json({ error: err.message });

    }

});

export default router;