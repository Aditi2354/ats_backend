/**
ATS Checker Utility (atsChecker.js)
--This module analyzes resumes to check ATS (Applicant Tracking System) compatibility.
--It evaluates important factors such as resume sections, formatting issues, keyword optimization, readability, and ATS red flags.
--The system uses NLP techniques to extract keywords and technical terms, calculates an overall ATS score (0–100), and generates recommendations and strengths to help improve the resume for better job application success.
--compromise is a JavaScript Natural Language Processing (NLP) library used to analyze text. 
--In this project it helps extract important words, noun phrases, and potential skills from the resume text to improve keyword detection for ATS analysis. 
* ATS Resume Checker Utility
 * Analyzes resumes for ATS (Applicant Tracking System) compatibility
 * Checks formatting, keywords, structure, and best practices
 */

// NLP library for smarter keyword/skill extraction
import nlp from 'compromise';


/**
 * Analyze resume for ATS compatibility
 * @param {string} text - Resume text content
 * @param {array} jobDescription - Optional job description for keyword matching
 * @returns {object} ATS analysis report
 */
function analyzeATSCompatibility(resumeText, jobDescription = null) {
    const analysis = {
        overall_score: 0,
        sections: {},
        warnings: [],
        recommendations: [],
        strengths: [],
        keyword_match: {},
        formatting_issues: [],
        readability: {}
    };

    const text = resumeText.toLowerCase();
    const lines = resumeText.split('\n');
    
    // 1. Check for essential sections
    analysis.sections = checkEssentialSections(resumeText);
    
    // 2. Check formatting issues
    analysis.formatting_issues = checkFormattingIssues(resumeText);
    
    // 3. Check keyword optimization
    analysis.keyword_match = analyzeKeywords(resumeText, jobDescription);
    
    // 4. Check readability
    analysis.readability = checkReadability(resumeText);
    
    // 5. Check for common ATS red flags
    analysis.red_flags = checkRedFlags(resumeText);
    
    // 6. Calculate overall score
    analysis.overall_score = calculateATSScore(analysis);
    
    // 7. Generate recommendations
    analysis.recommendations = generateRecommendations(analysis);
    
    // 8. Identify strengths
    analysis.strengths = identifyStrengths(analysis);

    return analysis;
}

/**
 * Check for essential resume sections
 */
function checkEssentialSections(resumeText) {
    const text = resumeText.toLowerCase();
    const sections = {
        contact_info: { found: false, score: 0 },
        summary_objective: { found: false, score: 0 },
        experience: { found: false, score: 0 },
        education: { found: false, score: 0 },
        skills: { found: false, score: 0 },
        certifications: { found: false, score: 0 }
    };

    // Check for contact info (email, phone)
    sections.contact_info.found = /([a-z0-9._-]+@[a-z0-9._-]+\.[a-z0-9_-]+)|(\+?1?\d{9,15})/.test(text);
    sections.contact_info.score = sections.contact_info.found ? 25 : 0;

    // Check for summary/objective
    if (/professional\s+summary|objective|career\s+summary|about\s+me|professional\s+profile/.test(text)) {
        sections.summary_objective.found = true;
        sections.summary_objective.score = 15;
    }

    // Check for experience/work history
    if (/experience|employment|work\s+history|professional\s+experience|positions?|roles?/.test(text) && 
        /\d{4}|\d{1,2}\/\d{1,2}|present|current/.test(text)) {
        sections.experience.found = true;
        sections.experience.score = 25;
    }

    // Check for education
    if (/education|degree|bachelor|master|diploma|certification|university|college|school/.test(text)) {
        sections.education.found = true;
        sections.education.score = 15;
    }

    // Check for skills
    if (/skills?|technical\s+skills?|core\s+competencies|expertise|proficiencies|tools/.test(text)) {
        sections.skills.found = true;
        sections.skills.score = 15;
    }

    // Check for certifications
    if (/certifications?|certificates?|licensed|certified/.test(text)) {
        sections.certifications.found = true;
        sections.certifications.score = 10;
    }

    return sections;
}

/**
 * Check formatting issues that might break ATS parsing
 */
function checkFormattingIssues(resumeText) {
    const issues = [];

    // Check for unusual characters
    const specialChars = resumeText.match(/[^\x00-\x7F]/g);
    if (specialChars && specialChars.length > 10) {
        issues.push({
            type: 'encoding',
            severity: 'warning',
            message: 'Resume contains many special/non-ASCII characters. ATS may have difficulty parsing.'
        });
    }

    // Check for tables/columns
    if (resumeText.includes('\t') || resumeText.match(/\|\s+/)) {
        issues.push({
            type: 'structure',
            severity: 'high',
            message: 'Resume appears to use tables or columns. Many ATS systems cannot parse tables properly. Use simple formatting instead.'
        });
    }

    // Check for graphics/images indicators
    if (/\[image\]|\[graphic\]|\[photo\]|\[logo\]/i.test(resumeText)) {
        issues.push({
            type: 'visual',
            severity: 'high',
            message: 'Resume contains images or graphics. ATS systems cannot process visual elements. Remove decorative images.'
        });
    }

    // Check line length (very long lines might not parse well)
    const longLines = resumeText.split('\n').filter(line => line.length > 120).length;
    if (longLines > 5) {
        issues.push({
            type: 'formatting',
            severity: 'low',
            message: 'Some lines are very long. Consider breaking them up for better readability in ATS.'
        });
    }

    // Check for multiple spaces
    if (/  {2,}/.test(resumeText)) {
        issues.push({
            type: 'formatting',
            severity: 'warning',
            message: 'Resume contains multiple consecutive spaces. This can confuse ATS parsing. Use single spaces.'
        });
    }

    // Check for PDF-specific issues (detected via text patterns)
    const bulletPoints = (resumeText.match(/^[\s]*[-•*]\s+/gm) || []).length;
    if (bulletPoints < 5) {
        issues.push({
            type: 'structure',
            severity: 'low',
            message: 'Resume has few bullet points. Consider using bullet points to highlight achievements and responsibilities.'
        });
    }

    return issues;
}

/**
 * Analyze keyword optimization
 */
function analyzeKeywords(resumeText, jobDescription = null) {
    const analysis = {
        keywords_found: [],
        keywords_missing: [],
        keyword_density: 0,
        job_match_score: 0,
        ats_keywords: {},
        nlp_terms: []    // terms extracted via NLP
    };

    // Common ATS keywords
    const atsKeywords = {
        technical_skills: ['python', 'java', 'javascript', 'c++', 'sql', 'react', 'angular', 'node.js', 
                          'aws', 'azure', 'docker', 'kubernetes', 'git', 'linux', 'windows', 'html', 'css'],
        experience_keywords: ['years of experience', 'managed', 'led', 'implemented', 'developed', 'designed',
                             'optimized', 'improved', 'increased', 'reduced', 'streamlined', 'automated'],
        soft_skills: ['communication', 'teamwork', 'leadership', 'problem-solving', 'time management',
                     'attention to detail', 'critical thinking', 'collaboration', 'project management'],
        education: ['bachelor', 'master', 'degree', 'diploma', 'certification', 'certified', 'trained'],
        achievements: ['award', 'recognized', 'promoted', 'achievement', 'success', 'accomplish', 'distinguished']
    };

    const text = resumeText.toLowerCase();
    let totalKeywords = 0;

    // run NLP to pull out noun phrases / potential skills
    try {
        const doc = nlp(resumeText);
        const nouns = doc.nouns().out('array');
        analysis.nlp_terms = Array.from(new Set(nouns.map(n=>n.toLowerCase())));
    } catch(e) {
        // if NLP fails, just ignore
        analysis.nlp_terms = [];
    }

    // Check ATS keywords
    for (let category in atsKeywords) {
        analysis.ats_keywords[category] = [];
        atsKeywords[category].forEach(keyword => {
            if (text.includes(keyword.toLowerCase())) {
                analysis.ats_keywords[category].push(keyword);
                analysis.keywords_found.push(keyword);
                totalKeywords++;
            }
        });
    }

    // Include NLP terms in keyword_found array
    analysis.nlp_terms.forEach(term => {
        if (term && !analysis.keywords_found.includes(term)) {
            analysis.keywords_found.push(term);
            totalKeywords++;
        }
    });

    // Calculate keyword density
    const words = text.split(/\s+/).length;
    analysis.keyword_density = Math.round((totalKeywords / words) * 100);

    // If job description provided, match keywords
    if (jobDescription) {
        const jobText = jobDescription.toLowerCase();
        const jobKeywords = jobText.match(/\b[a-z]+(?:\s+[a-z]+)?\b/g) || [];
        
        const matchedKeywords = jobKeywords.filter(keyword => 
            text.includes(keyword) && keyword.length > 3
        );

        analysis.job_match_score = jobKeywords.length > 0 ? 
            Math.round((matchedKeywords.length / Math.min(jobKeywords.length, 50)) * 100) : 0;
    }

    return analysis;
}

/**
 * Check resume readability
 */
function checkReadability(resumeText) {
    const lines = resumeText.split('\n');
    const words = resumeText.split(/\s+/).length;
    const sentences = resumeText.split(/[.!?]+/).length;
    const avgWordsPerSentence = sentences > 0 ? Math.round(words / sentences) : 0;
    const avgWordsPerLine = lines.length > 0 ? Math.round(words / lines) : 0;

    return {
        total_lines: lines.length,
        total_words: words,
        total_sentences: sentences,
        avg_words_per_sentence: avgWordsPerSentence,
        avg_words_per_line: avgWordsPerLine,
        readability_score: calculateReadabilityScore(avgWordsPerSentence, avgWordsPerLine),
        readability_level: getReadabilityLevel(avgWordsPerSentence)
    };
}

/**
 * Calculate readability score (0-100)
 */
function calculateReadabilityScore(avgWordsPerSentence, avgWordsPerLine) {
    let score = 100;
    
    // Penalize if sentences are too long (harder to parse)
    if (avgWordsPerSentence > 20) score -= 15;
    else if (avgWordsPerSentence > 15) score -= 8;
    
    // Penalize if lines are too long
    if (avgWordsPerLine > 25) score -= 10;
    else if (avgWordsPerLine > 15) score -= 5;
    
    return Math.max(0, score);
}

/**
 * Get readability level
 */
function getReadabilityLevel(avgWordsPerSentence) {
    if (avgWordsPerSentence > 20) return 'Complex';
    if (avgWordsPerSentence > 15) return 'Moderate';
    if (avgWordsPerSentence > 10) return 'Good';
    return 'Excellent';
}

/**
 * Check for ATS red flags
 */
function checkRedFlags(resumeText) {
    const flags = [];
    const text = resumeText.toLowerCase();

    // Check for common issues
    const redFlagPatterns = [
        { pattern: /\[click here\]|\[link\]|\[apply\]/i, message: 'Contains clickable elements or hyperlinks - ATS may not parse correctly' },
        { pattern: /^[A-Z]{2,}[A-Z\s]{10,}/gm, message: 'Contains text in ALL CAPS - may indicate images or graphics' },
        { pattern: /©|™|®/g, message: 'Contains special symbols that may confuse ATS parsing' },
        { pattern: /footer|page \d|header/i, message: 'Contains page elements that ATS might not handle well' },
        { pattern: /color:|#[0-9a-f]{6}|rgb\(/i, message: 'May contain color formatting that ATS cannot process' }
    ];

    redFlagPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(resumeText)) {
            flags.push({
                pattern: pattern.toString(),
                message: message,
                severity: 'warning'
            });
        }
    });

    // Check for missing critical info
    if (!/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}/.test(text)) {
        flags.push({
            pattern: 'date',
            message: 'No dates found in resume. ATS needs dates for work history and education.',
            severity: 'high'
        });
    }

    return flags;
}

/**
 * Calculate overall ATS score - DYNAMIC ANALYSIS
 */
function calculateATSScore(analysis) {
    let score = 0;

    // 1. Essential Sections (0-30 points)
    let sectionScore = 0;
    let foundSections = 0;
    Object.values(analysis.sections).forEach(section => {
        if (section.found) {
            sectionScore += section.score;
            foundSections++;
        }
    });
    score += Math.min(30, sectionScore);

    // 2. Contact Info Critical (0-10 points)
    if (analysis.sections.contact_info.found) {
        score += 10;
    }

    // 3. Keywords Quality (0-20 points)
    const keywordCount = analysis.keyword_match.keywords_found.length;
    if (keywordCount >= 20) score += 20;
    else if (keywordCount >= 15) score += 16;
    else if (keywordCount >= 10) score += 12;
    else if (keywordCount >= 5) score += 6;
    else score += Math.round((keywordCount / 5) * 6);

    // 4. Keyword Density (0-10 points)
    const density = analysis.keyword_match.keyword_density;
    if (density >= 5) score += 10;
    else if (density >= 3) score += 7;
    else if (density >= 1) score += 4;
    else score += 1;

    // 5. Readability Score (0-15 points)
    const readabilityScore = analysis.readability.readability_score;
    score += Math.round((readabilityScore / 100) * 15);

    // 6. No Formatting Issues (0-10 points)
    if (analysis.formatting_issues.length === 0) {
        score += 10;
    } else {
        const penalty = analysis.formatting_issues.reduce((p, issue) => 
            p + (issue.severity === 'high' ? 3 : 1), 0);
        score -= Math.min(10, penalty);
    }

    // 7. No Red Flags (0-5 points)
    if (analysis.red_flags.length === 0) {
        score += 5;
    } else {
        const penalty = analysis.red_flags.length * 1.5;
        score -= Math.min(5, penalty);
    }

    // 8. Job Match Score if provided (0-10 points)
    if (analysis.keyword_match.job_match_score) {
        const jobMatch = analysis.keyword_match.job_match_score;
        score += Math.round((jobMatch / 100) * 10);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate recommendations
 */
function generateRecommendations(analysis) {
    const recommendations = [];

    // Check sections
    if (!analysis.sections.contact_info.found) {
        recommendations.push('❌ Add contact information (email and phone number at the top)');
    }

    if (!analysis.sections.summary_objective.found) {
        recommendations.push('⚠️  Add a professional summary or career objective');
    }

    if (!analysis.sections.skills.found) {
        recommendations.push('⚠️  Add a dedicated "Skills" section with relevant keywords');
    }

    // Check formatting
    if (analysis.formatting_issues.length > 0) {
        const highSeverity = analysis.formatting_issues.filter(i => i.severity === 'high');
        if (highSeverity.length > 0) {
            recommendations.push(`🔴 Fix ${highSeverity.length} critical formatting issues`);
        }
    }

    // Check keywords
    if (analysis.keyword_match.keywords_found.length < 10) {
        recommendations.push('📝 Add more industry-specific keywords and technical terms');
    }

    if (analysis.keyword_match.keyword_density < 3) {
        recommendations.push('📊 Increase keyword density - use industry-specific terminology more frequently');
    }

    // Check readability
    if (analysis.readability.readability_score < 70) {
        recommendations.push('📖 Improve readability - use shorter sentences and simpler structure');
    }

    // Check red flags
    if (analysis.red_flags.length > 0) {
        recommendations.push(`⚠️  Address ${analysis.red_flags.length} potential ATS parsing issues`);
    }

    // Add positive recommendations
    if (analysis.overall_score < 70) {
        recommendations.push('📌 Consider using an ATS-friendly template with simple formatting');
    }

    return recommendations;
}

/**
 * Identify strengths
 */
function identifyStrengths(analysis) {
    const strengths = [];

    if (analysis.sections.contact_info.found) {
        strengths.push('✅ Contact information is properly formatted');
    }

    if (analysis.sections.experience.found) {
        strengths.push('✅ Work experience section is present with dates');
    }

    if (analysis.sections.skills.found) {
        strengths.push('✅ Skills section is clearly defined');
    }

    if (analysis.formatting_issues.length === 0) {
        strengths.push('✅ No major formatting issues detected');
    }

    if (analysis.keyword_match.keywords_found.length > 15) {
        strengths.push('✅ Good keyword coverage for ATS systems');
    }

    if (analysis.readability.readability_score > 75) {
        strengths.push('✅ Excellent readability and structure');
    }

    return strengths;
}

/**
 * Get ATS score interpretation
 */
function getATSScoreInterpretation(score) {
    if (score >= 80) return { level: 'Excellent', description: 'Resume is highly optimized for ATS systems' };
    if (score >= 70) return { level: 'Good', description: 'Resume is well-formatted and should parse well' };
    if (score >= 60) return { level: 'Fair', description: 'Resume may have some ATS parsing issues' };
    if (score >= 50) return { level: 'Poor', description: 'Resume has several ATS compatibility issues' };
    return { level: 'Critical', description: 'Resume needs significant improvements for ATS compatibility' };
}

/**
 * Analyze resume for job market alignment
 * @param {array} resumeSkills - Skills extracted from resume
 * @param {array} jobMarketSkills - In-demand skills in market
 * @returns {object} Job market alignment analysis
 */
function analyzeJobMarketAlignment(resumeSkills, jobMarketSkills) {
    const marketSkillsSet = new Set(jobMarketSkills.map(s => s.toLowerCase()));
    const resumeSkillsSet = new Set(resumeSkills.map(s => s.toLowerCase()));
    
    // Find skills that match market demand
    const marketRelevantSkills = [];
    const otherSkills = [];
    
    for (let skill of resumeSkills) {
        if (marketSkillsSet.has(skill.toLowerCase())) {
            marketRelevantSkills.push(skill);
        } else {
            otherSkills.push(skill);
        }
    }
    
    // Calculate market relevance percentage
    const marketRelevancePercentage = resumeSkills.length > 0 
        ? Math.round((marketRelevantSkills.length / resumeSkills.length) * 100)
        : 0;
    
    return {
        market_relevant_skills: marketRelevantSkills,
        market_irrelevant_skills: otherSkills,
        market_relevance_percentage: marketRelevancePercentage,
        recommendations: generateMarketAlignmentRecommendations(marketRelevantSkills, jobMarketSkills)
    };
}

/**
 * Generate market alignment recommendations
 */
function generateMarketAlignmentRecommendations(hasSkills, marketSkills) {
    const recommendations = [];
    const missingTopSkills = marketSkills.slice(0, 10).filter(
        skill => !hasSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
    );
    
    if (missingTopSkills.length > 0) {
        recommendations.push(`📚 Consider learning these in-demand skills: ${missingTopSkills.slice(0, 3).join(', ')}`);
    }
    
    if (hasSkills.length > 8) {
        recommendations.push('✅ You have strong technical skills coverage!');
    }
    
    if (hasSkills.length < 5) {
        recommendations.push('📝 Add more technical skills to improve market competitiveness');
    }
    
    return recommendations;
}

/**
 * Analyze resume against freshers/internship market
 */
function analyzeForFresherMarket(resumeText, resumeSkills) {
    const analysis = {
        is_fresher_friendly: true,
        score: 0,
        issues: [],
        strengths: [],
        improvements: []
    };
    
    const text = resumeText.toLowerCase();
    
    // Check for fresher-relevant keywords
    const fresherKeywords = ['fresher', 'intern', 'graduate', 'entry level', 'trainee', '0-2 years', 'beginner'];
    const hasFresherKeywords = fresherKeywords.some(kw => text.includes(kw));
    
    // Check for internship experience
    const hasInternship = /intern|internship|summer project|college project|academic project/.test(text);
    
    // Check for certifications/courses
    const hasCertifications = /certification|certificate|course|training|bootcamp|mooc/.test(text);
    
    // Scoring for fresher market
    analysis.score += hasFresherKeywords ? 25 : 0;
    analysis.score += hasInternship ? 25 : 0;
    analysis.score += hasCertifications ? 20 : 0;
    analysis.score += resumeSkills.length >= 5 ? 20 : resumeSkills.length * 4;
    
    // Strengths
    if (hasInternship) {
        analysis.strengths.push('✅ Shows practical internship experience');
    }
    if (hasCertifications) {
        analysis.strengths.push('✅ Has relevant certifications/courses');
    }
    if (resumeSkills.length >= 8) {
        analysis.strengths.push('✅ Good technical skills for fresher role');
    }
    
    // Issues
    if (!hasInternship && !text.includes('project')) {
        analysis.issues.push('⚠️ No internship or project experience mentioned');
    }
    if (!hasCertifications && !text.includes('course')) {
        analysis.issues.push('⚠️ Consider adding relevant certifications/online courses');
    }
    if (resumeSkills.length < 5) {
        analysis.issues.push('📝 Add more technical skills');
    }
    
    // Improvements
    analysis.improvements.push('Add academic/college projects with technologies used');
    analysis.improvements.push('Mention any open-source contributions');
    analysis.improvements.push('Include relevant certifications (free online courses count)');
    analysis.improvements.push('Highlight leadership in student organizations');
    
    return analysis;
}

export {
    analyzeATSCompatibility,
    checkEssentialSections,
    checkFormattingIssues,
    analyzeKeywords,
    checkReadability,
    checkRedFlags,
    calculateATSScore,
    generateRecommendations,
    identifyStrengths,
    getATSScoreInterpretation,
    analyzeJobMarketAlignment,
    analyzeForFresherMarket
};
