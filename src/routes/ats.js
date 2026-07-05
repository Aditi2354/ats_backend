/* ATS Resume Checker Backend (ats.js)
   With Gemini AI + Final Combined Score
*/

import express from "express";
import { PDFExtract } from "pdf.js-extract";

import {
  analyzeATSCompatibility,
  getATSScoreInterpretation,
  analyzeJobMarketAlignment,
  analyzeForFresherMarket
} from "../utils/atsChecker.js";

import {
  extractSkills,
  getInDemandSkills,
  matchSkillsWithJob
} from "../utils/skillExtractor.js";

import { analyzeResumeWithAI } from "../utils/aiATSAnalyzer.js";

import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();
const pdfExtract = new PDFExtract();

/* ==============================
   Extract text from uploaded PDF
============================== */

function extractPDFText(buffer) {
  return new Promise((resolve, reject) => {

    pdfExtract.extractBuffer(buffer, {}, (err, data) => {

      if (err) return reject(err);

      if (!data?.pages) return resolve("");

      const text = data.pages
        .map(page =>
          page.content.map(item => item.str).join(" ")
        )
        .join("\n");

      resolve(text);

    });

  });
}

/* ==============================
   POST /api/ats/check
============================== */

router.post("/check", authenticateToken, async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded" });
    }

    console.log("🔍 ATS analysis started...");

    const fullText = await extractPDFText(req.file.buffer);

    if (!fullText || fullText.length < 50) {
      return res.status(400).json({
        error: "Could not extract enough text from PDF"
      });
    }

    /* ==============================
       RULE BASED ATS ENGINE
    ============================== */

    const atsAnalysis = analyzeATSCompatibility(fullText);

    const interpretation =
      getATSScoreInterpretation(atsAnalysis.overall_score);

    /* ==============================
       SKILLS
    ============================== */

    const skills = extractSkills(fullText);

    const inDemandSkills = getInDemandSkills();

    const marketAlignment = analyzeJobMarketAlignment(
      skills,
      inDemandSkills.map(s => s.skill)
    );

    const fresherMarket = analyzeForFresherMarket(fullText, skills);

    /* ==============================
       AI ANALYSIS
    ============================== */

    let ai_analysis = null;
    let ai_score = null;

    try {

      ai_analysis = await analyzeResumeWithAI(fullText);

      if (ai_analysis?.ATS_SCORE) {
        ai_score = ai_analysis.ATS_SCORE;
      }

    } catch (err) {

      console.log("Gemini AI error:", err.message);

    }

    /* ==============================
       FINAL SCORE (COMBINED)
    ============================== */

    let final_score = atsAnalysis.overall_score;

    if (ai_score) {

      final_score = Math.round(
        (atsAnalysis.overall_score * 0.6) +
        (ai_score * 0.4)
      );

    }

    console.log(`✅ Final Resume Score: ${final_score}/100`);

    /* ==============================
       RESPONSE
    ============================== */

    res.json({

      final_score: final_score,
      ats_score: atsAnalysis.overall_score,
      ai_score: ai_score,

      ats_level: interpretation.level,
      ats_description: interpretation.description,

      sections: atsAnalysis.sections,
      keywords: atsAnalysis.keyword_match,
      readability: atsAnalysis.readability,
      strengths: atsAnalysis.strengths,

      detected_skills: skills,

      job_market: {
        alignment_score: marketAlignment.market_relevance_percentage,
        market_relevant_skills: marketAlignment.market_relevant_skills,
        in_demand_skills_sample: inDemandSkills.slice(0, 10),
        recommendations: marketAlignment.recommendations
      },

      fresher_market: fresherMarket,

      ai_analysis: ai_analysis

    });

  } catch (err) {

    console.error("❌ ATS CHECK ERROR:", err);

    res.status(500).json({
      error: "ATS analysis failed",
      message: err.message
    });

  }

});

export default router;