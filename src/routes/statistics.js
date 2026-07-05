/*Statistics Module (statistics.js)
--This module provides analytics and statistics about resumes and job matches. 
--It verifies the logged-in user using JWT authentication, retrieves stored resumes and jobs from the database, and analyzes the user’s skills. 
--The system calculates metrics such as total job matches, skill distribution, in-demand skills alignment, and fresher resume detection, then returns these insights as statistics for the dashboard. */

/* Statistics Module (statistics.js)
--This module provides analytics and statistics about resumes and job matches.
--It verifies the logged-in user using JWT authentication, retrieves stored resumes and jobs from the database,
--and analyzes the user’s skills to generate dashboard insights.
*/

import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getAllJobs, getAllResumes } from "../utils/database.js";
import { getInDemandSkills } from "../utils/skillExtractor.js";
import { getTotalLiveMatchesCount } from "../utils/statsStore.js";

const router = express.Router();

/**
 * GET /api/statistics
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    // Logged In User from middleware
    const userId = req.user.id;

    // Fetch Database Data
    const jobs = [
      { id: 1, title: "Software Engineer Intern", experience_level: "Intern" },
      { id: 2, title: "Junior Developer", experience_level: "Fresher" },
      { id: 3, title: "Data Analyst Intern", experience_level: "Intern" },
      { id: 4, title: "Graduate Trainee", experience_level: "Fresher" },
      { id: 5, title: "Entry Level QA", experience_level: "Entry Level" }
    ];

    const allResumes = await getAllResumes() || [];

    // Filter User Resumes
    const resumes = userId
      ? allResumes.filter(r => r.user_id === userId)
      : allResumes;

    // Count Job Openings
    const jobOpenings = jobs.length;

    // Count Live Fresher/Internship Jobs Matched
    const liveFresherJobsMatched = jobs.filter(job =>
      /fresher|intern|entry level/i.test(job.experience_level || "")
    ).length;

    // Extract Resume Skills
    const allResumeSkills = resumes.flatMap(r => {
      const skills = r.skills || [];
      return skills.map(s =>
        typeof s === "string"
          ? s
          : (s.skill_name || s.skill || "")
      );
    });

    const uniqueResumeSkills = [...new Set(allResumeSkills)];
    const inDemandSkills = getInDemandSkills();

    const resumeSkillMarketValue = uniqueResumeSkills.map(skill => {
      const demand = inDemandSkills.find(
        s => s.skill.toLowerCase() === String(skill).toLowerCase()
      );
      const occurrences = allResumeSkills.filter(
        s => String(s).toLowerCase() === String(skill).toLowerCase()
      ).length;
      return {
        skill,
        occurrences,
        market_demand: demand?.demand || 0
      };
    }).sort((a, b) => b.market_demand - a.market_demand);

    // Fresher Detection
    const fresherResumes = resumes.filter(r => {
      if (r.experience === "no_experience") return true;
      const text =
        (r.summary || "") +
        (r.raw_text || "");
      return /fresher|intern|graduate|entry level|0-2 years|beginner|trainee/i.test(text);
    });

    // Latest Resume Skill Distribution
    const latestResume =
      resumes.length > 0 ? resumes[resumes.length - 1] : null;
    const userSkillsRaw = latestResume?.skills || [];
    const userSkills = userSkillsRaw.map(s =>
      typeof s === "string"
        ? s
        : (s.skill_name || s.skill || "")
    );
    const skillCount = {};
    userSkills.forEach(skill => {
      if (!skill) return;
      skillCount[skill] = (skillCount[skill] || 0) + 1;
    });
    const totalSkills = userSkills.length;
    const userSkillDistribution = Object.entries(skillCount).map(
      ([skill, count]) => ({
        skill,
        occurrences: count,
        percentage: totalSkills
          ? Math.round((count / totalSkills) * 100)
          : 0
      })
    ).sort((a, b) => b.occurrences - a.occurrences);

    // Skill Market Alignment
    const alignedSkills = resumeSkillMarketValue.filter(
      s => s.market_demand > 0
    );
    const avgMarketAlignment = alignedSkills.length
      ? Math.round(
        alignedSkills.reduce((sum, s) => sum + s.market_demand, 0) /
        alignedSkills.length
      )
      : 0;

    // Live Job Counts
    const totalLiveMatches = getTotalLiveMatchesCount();

    // API RESPONSE
    res.json({
      total_resumes_analyzed: resumes.length,
      fresher_profiles: resumes.length,
      job_openings: jobOpenings,
      live_jobs_matched: resumes.length > 0 ? totalLiveMatches * resumes.length : 0,
     //live_jobs_matched: totalLiveMatches,
      jobs_by_level: {
        fresher: fresherResumes.length,
        junior: 0
      },
      top_resume_skills: resumeSkillMarketValue.slice(0, 10),
      skill_market_alignment: {
        average_alignment_score: avgMarketAlignment
      },
      user_skill_distribution: userSkillDistribution,
      locations: [...new Set(jobs.map(j => j.location || "Unknown"))]
    });

  } catch (err) {
    console.error("Statistics Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;