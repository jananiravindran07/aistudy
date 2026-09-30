import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { z } from 'zod';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type Mode = 'explain' | 'notes' | 'quiz' | 'plan';

interface StudyOptions {
  days?: number | undefined;
  hours?: number | undefined;
  goal?: string | undefined;
  context?: string | undefined;
}

interface Provider {
  generate(systemInstruction: string, prompt: string): Promise<string>;
}

const configuredModel = process.env.MODEL_NAME?.trim();
const MODEL = !configuredModel || configuredModel === 'gemini-2.5-flash' ? 'gemini-3.8-flash' : configuredModel;
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
const quizSchema = z.object({
  questions: z.array(z.object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1),
  })).min(5).max(10),
}).strict();

const geminiProvider: Provider = {
  async generate(systemInstruction, prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key' || apiKey === 'your-key-here') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: { systemInstruction, maxOutputTokens: 3000, temperature: 0.65 },
        });
        return response.text ?? '';
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
        if (status !== 503 || attempt === 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
    return '';
  },
};

const openaiProvider: Provider = {
  async generate(systemInstruction, prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      temperature: 0.65,
    });
    return response.choices[0]?.message.content ?? '';
  },
};

const getProvider = (): Provider => {
  const providerName = process.env.LLM_PROVIDER?.trim()
    ?? (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'gemini');
  if (providerName === 'gemini') return geminiProvider;
  if (providerName === 'openai') return openaiProvider;
  throw new Error(`Unsupported LLM_PROVIDER: ${providerName}`);
};

const createPrompt = (topic: string, mode: Mode, options: StudyOptions) => {
  const goal = options.goal?.trim();
  switch (mode) {
    case 'explain':
      return `Explain "${topic}" clearly, include a concrete example and an analogy, then finish with one key takeaway.`;
    case 'notes':
      return `Create concise Markdown study notes for "${topic}". Use headings and bullet points, bold key terms, and finish with a short summary.`;
    case 'quiz':
      return `Create exactly 5 multiple-choice questions about "${topic}". Return ONLY a JSON object matching this schema: {"questions":[{"question":"string","options":["string","string","string","string"],"correctAnswer":0,"explanation":"string"}]}. correctAnswer is a zero-based option index. No markdown fences or prose outside JSON.`;
    case 'plan': {
      const days = Math.min(30, Math.max(1, Math.floor(options.days ?? 7)));
      const hours = Math.min(12, Math.max(1, options.hours ?? 2));
      return `Create a practical ${days}-day study plan for "${topic}" with ${hours} available hours per day. ${goal ? `The learner's goal is: ${goal}.` : ''} Include a day-by-day schedule, breaks, and a brief review activity.`;
    }
  }
};

const parseQuiz = (raw: string) => {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Quiz response did not contain JSON');
  return quizSchema.parse(JSON.parse(jsonMatch[0]));
};

export const generateStudyContent = async (
  topic: string,
  mode: Mode,
  difficulty: Difficulty,
  options: StudyOptions = {},
) => {
  const provider = getProvider();
  const systemInstruction = `You are a friendly, encouraging study tutor. Adapt vocabulary, depth, and examples for a ${difficulty} learner. Be accurate, clear, and supportive without being overly chatty.`;
  const context = options.context?.trim();
  const prompt = `${createPrompt(topic, mode, options)}${context ? `\n\nUse this document excerpt as the source of truth. Do not invent facts that conflict with it.\n<document>\n${context}\n</document>` : ''}`;

  if (mode !== 'quiz') return provider.generate(systemInstruction, prompt);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const retryPrompt = attempt === 0
        ? prompt
        : `${prompt}\nYour previous response did not validate. Regenerate the complete response as valid JSON with 5-10 questions, exactly 4 options each, correctAnswer from 0 to 3, and a non-empty explanation.`;
      const raw = await provider.generate(systemInstruction, retryPrompt);
      return parseQuiz(raw);
    } catch (error) {
      if (!(error instanceof z.ZodError) && !(error instanceof SyntaxError) && !(error instanceof Error && error.message.includes('Quiz response did not contain JSON'))) {
        throw error;
      }
      lastError = error;
    }
  }

  console.error('Quiz validation failed after retry:', lastError);
  throw new Error('The tutor returned an invalid quiz twice. Please try again.');
};