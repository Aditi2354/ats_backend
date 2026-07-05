/**
--This module calculates the match percentage between a user’s skills and job requirements.
--It compares the skills extracted from the resume with the required skills of each job and identifies matched and missing skills. 
--Based on this comparison, it generates a match percentage, helping the system recommend the most relevant job opportunities for the user.
 * Job Matching Utility
 * Calculates match percentage between user skills and job requirements
 */
/**
--This module calculates the match percentage between a user’s skills and job requirements.
--It compares the skills extracted from the resume with the required skills of each job and identifies matched and missing skills. 
--Based on this comparison, it generates a match percentage, helping the system recommend the most relevant job opportunities for the user.

 * Job Matching Utility
 * Calculates match percentage between user skills and job requirements
 */

/**
 * Calculate match between user skills and job requirements
 * @param {array} userSkills - Array of user's skills
 * @param {array} jobRequirements - Array of job required skills
 * @param {object} options - Optional settings for match calculation
 * @param {number} options.fresherWeight - Default match percentage for fresher-friendly jobs (default: 30)
 * @param {boolean} options.caseInsensitive - Whether to perform case-insensitive matching (default: true)
 * @returns {object} Match data with percentage and matched/missing skills
 */
function calculateMatch(userSkills = [], jobRequirements = [], options = {}) {
    const {
        fresherWeight = 30,
        caseInsensitive = true
    } = options;

    // Ensure arrays
    if (!Array.isArray(userSkills)) userSkills = [];
    if (!Array.isArray(jobRequirements)) jobRequirements = [];

    // Handle empty job requirements (fresher friendly)
    if (jobRequirements.length === 0) {
        return {
            matched: [],
            missing: [],
            percentage: fresherWeight,
            total_required: 1
        };
    }

    // Convert user skills to a Set for faster lookups
    const userSkillsSet = new Set(
        userSkills
            .filter(skill => typeof skill === "string")
            .map(skill => (caseInsensitive ? skill.toLowerCase() : skill))
    );

    const matched = [];
    const missing = [];

    for (let req of jobRequirements) {
        if (typeof req !== "string") {
            continue;
        }

        const requirement = caseInsensitive ? req.toLowerCase() : req;

        if (userSkillsSet.has(requirement)) {
            matched.push(req);
        } else {
            missing.push(req);
        }
    }

    // Calculate percentage
    const percentage = matched.length > 0
        ? Math.round((matched.length / jobRequirements.length) * 100)
        : fresherWeight;

    return {
        matched,
        missing,
        percentage,
        total_required: jobRequirements.length
    };
}

export {
    calculateMatch
};