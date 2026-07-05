import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeResumeWithAI(resumeText) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    );

    const safeText = resumeText.substring(0, 8000);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000
      }
    });

    const prompt = `
You are an ATS resume analysis system used by recruiters.

Analyze the resume and return the result EXACTLY in this format:

ATS Score: <number>/100
Reason: <short explanation>

Strengths:
- point
- point
- point

Missing Keywords:
- keyword
- keyword
- keyword

Improvements:
- suggestion
- suggestion
- suggestion

Important rules:
- Always include ALL sections.
- Each section must contain at least 3 items.
- Keep response under 150 words.

Resume:
${safeText}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log("🤖 Gemini Raw Response:");
    console.log(text);

    const scoreMatch = text.match(
      /ATS\s*Score\s*:\s*(\d{1,3})\s*\/\s*100/i
    );

    const aiScore = scoreMatch
      ? Math.min(100, Math.max(0, Number(scoreMatch[1])))
      : null;

    console.log("🤖 Parsed AI Score:", aiScore);

    return {
      ATS_SCORE: aiScore,
      analysis: text
    };

  } catch (error) {
    console.error("❌ Gemini AI Error:", error.message);
    throw error;
  }
}