/**
Skill Extraction Utility
Handles skill detection and categorization from resume text
Optimized for Indian job market and fresher roles
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================
LOAD SKILLS DATA
================================ */

const skillsPath = path.join(__dirname, "../../data/skills.json");
const skillsData = JSON.parse(fs.readFileSync(skillsPath, "utf8"));

const { technical_skills, categories } = skillsData;

const allSkills = new Set([
  ...technical_skills,
  ...Object.values(categories).flat()
]);

/* ================================
SKILL ALIASES
================================ */

const skillAliases = {
  js: "JavaScript",
  ts: "TypeScript",
  py: "Python",
  cpp: "C++",

  "react.js": "React",
  reactjs: "React",

  "node.js": "Node.js",
  node: "Node.js",

  expressjs: "Express",
  "express.js": "Express",

  mongodb: "MongoDB",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mysql: "MySQL",

  aws: "AWS",
  gcp: "Google Cloud",
  azure: "Azure",

  html: "HTML",
  css: "CSS",

  git: "Git",
  github: "Git",

  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",

  /* NEW ADDITIONS */

  spring: "Spring Boot",
  "springboot": "Spring Boot",
  "spring-boot": "Spring Boot",

  /* AI & Blockchain */
  ai: "Artificial Intelligence",
  ml: "Machine Learning",
  dl: "Deep Learning",
  nlp: "NLP",
  cv: "Computer Vision",
  llm: "LLM",
  solidity: "Solidity",
  web3: "Web3.js"
};

/* ================================
MARKET DEMAND SCORE
================================ */

const marketDemand = {
  JavaScript: 95,
  Python: 93,
  React: 92,
  Nodejs: 88,
  SQL: 87,
  Java: 85,

  "Spring Boot": 86,

  AWS: 84,
  TypeScript: 82,
  Docker: 80,
  MongoDB: 78,
  Angular: 75,
  "REST API": 75,

  Git: 85,
  HTML: 88,
  CSS: 85,

  Express: 80,
  PostgreSQL: 76,
  Kubernetes: 72,
  Azure: 70,

  "Problem Solving": 90,
  Communication: 88,
  "Team Work": 87,
  Agile: 80,
  Scrum: 78,

  /* AI & Blockchain */
  "Artificial Intelligence": 96,
  "Machine Learning": 94,
  "Deep Learning": 92,
  NLP: 90,
  "Computer Vision": 88,
  LLM: 97,
  Solidity: 89,
  "Web3.js": 87,
  "Smart Contracts": 91
};

/* ================================
HELPER: SAFE WORD MATCH
================================ */

function containsSkill(text, skill) {

  const regex = new RegExp(
    `\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  );

  return regex.test(text);
}

/* ================================
EXTRACT SKILLS FROM RESUME
================================ */

function extractSkills(text) {

  const cleanText = text.toLowerCase();
  const foundSkills = new Map();

  /* DIRECT SKILL MATCH */

  for (const skill of allSkills) {

    if (containsSkill(cleanText, skill.toLowerCase())) {

      foundSkills.set(skill, marketDemand[skill] || 50);

    }

  }

  /* ALIAS MATCH */

  for (const [alias, skill] of Object.entries(skillAliases)) {

    if (containsSkill(cleanText, alias.toLowerCase())) {

      if (!foundSkills.has(skill)) {

        foundSkills.set(skill, marketDemand[skill] || 50);

      }

    }

  }

  /* SORT BY MARKET DEMAND */

  const sorted = [...foundSkills.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);

  return sorted;

}

/* ================================
CATEGORIZE SKILLS
================================ */

function categorizeSkills(skills) {

  const categorized = {};

  for (const category in categories) {

    categorized[category] = skills.filter(skill =>
      categories[category].includes(skill)
    );

  }

  return categorized;

}

/* ================================
EXTRACT SKILLS FROM JOB DESCRIPTION
================================ */

function extractSkillsFromText(text) {

  if (!text || text.trim().length === 0) {

    return ["JavaScript", "Python", "Java", "Web Development"];

  }

  return extractSkills(text);

}

/* ================================
MATCH RESUME WITH JOB
================================ */

function matchSkillsWithJob(resumeSkills, jobSkills) {

  const resumeSet = new Set(resumeSkills.map(s => s.toLowerCase()));
  const jobSet = new Set(jobSkills.map(s => s.toLowerCase()));

  const matched = [];
  const missing = [];
  const extra = [];

  resumeSkills.forEach(skill => {

    if (jobSet.has(skill.toLowerCase())) matched.push(skill);
    else extra.push(skill);

  });

  jobSkills.forEach(skill => {

    if (!resumeSet.has(skill.toLowerCase())) missing.push(skill);

  });

  const matchPercentage =
    jobSkills.length > 0
      ? Math.round((matched.length / jobSkills.length) * 100)
      : 0;

  return {
    matched,
    missing,
    extra,
    matchPercentage,
    resumeHasAllRequired: missing.length === 0
  };

}

/* ================================
TOP IN-DEMAND SKILLS
================================ */

function getInDemandSkills() {

  return Object.entries(marketDemand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([skill, demand]) => ({
      skill,
      demand
    }));

}

/* ================================
SKILL MARKET VALUE
================================ */

function getSkillMarketValue(skill) {

  return marketDemand[skill] || 0;

}

/* ================================
EXPORTS
================================ */

export {
  extractSkills,
  categorizeSkills,
  extractSkillsFromText,
  matchSkillsWithJob,
  getInDemandSkills,
  getSkillMarketValue,
  skillAliases,
  marketDemand,
  allSkills
};