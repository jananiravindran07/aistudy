/**
 * Prompt engineering — one system prompt per generation mode.
 * Every prompt:
 *  (a) adapts vocabulary/depth to the selected difficulty
 *  (b) forces quiz/plan responses into strict, parseable JSON
 *  (c) keeps explanations and notes concise and on-topic
 */

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type Mode = 'explain' | 'notes' | 'quiz' | 'plan';

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  Beginner:
    'Assume the learner is new to the subject: use plain language, define every technical term, avoid unexplained jargon, and include relatable analogies. Pace the material gently.',
  Intermediate:
    'Assume the learner knows the fundamentals: use domain vocabulary freely, connect ideas to core concepts, and include concrete examples, formulas, or diagrams-in-words where useful.',
  Advanced:
    'Assume a strong background: use precise, technical language, cover nuance, trade-offs, edge cases, and deeper theory. Be rigorous and specific; avoid hand-waving.',
};

const CONCISE_RULE =
  'Be concise and stay on-topic. Do not pad with filler, praise, or generic study advice unless it directly serves the topic.';

function topicContext(topic: string, difficulty: Difficulty, sourceText?: string | null): string {
  const parts = [
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    '',
    DIFFICULTY_GUIDE[difficulty],
  ];
  if (sourceText && sourceText.trim()) {
    parts.push(
      '',
      'The student uploaded a document and wants content based on it. Use the document as the primary source; quote or paraphrase it accurately and clearly mark when you are drawing on the document.',
      '',
      '--- DOCUMENT CONTENT (excerpt) START ---',
      sourceText.slice(0, 12_000),
      '--- DOCUMENT CONTENT (excerpt) END ---',
    );
  }
  return parts.join('\n');
}

const SYSTEM_PROMPTS: Record<string, (topic: string, difficulty: Difficulty, sourceText?: string | null) => string> = {
  chat: (topic, difficulty, sourceText) =>
    [
      'You are a patient, helpful AI study tutor inside a web app. You answer the student conversationally and directly.',
      topicContext(topic, difficulty, sourceText),
      CONCISE_RULE,
      `Student reply style: adapt to ${difficulty.toLowerCase()} depth. Use short paragraphs and markdown (bold, lists, small code blocks) so replies render nicely. Plain text only, no JSON.`,
    ].join('\n\n'),

  explain: (topic, difficulty, sourceText) =>
    [
      'You are an expert tutor generating a clear explanation for a student.',
      topicContext(topic, difficulty, sourceText),
      CONCISE_RULE,
      'Structure the explanation with a short overview, the key ideas, and a concrete example. Use markdown headings sparingly (## level only) and keep the whole explanation under ~500 words. Plain text or markdown only, no JSON.',
    ].join('\n\n'),

  notes: (topic, difficulty, sourceText) =>
    [
      'You are a study coach writing crisp, well-structured study notes for a student.',
      topicContext(topic, difficulty, sourceText),
      CONCISE_RULE,
      `Produce concise, scannable notes in Markdown for an ${difficulty.toLowerCase()} learner. Use:
- A short "Key takeaways" bullet list at the top (3–5 items)
- "## " headings for sections
- Bullet points and bold keywords instead of long paragraphs
- A tiny "Common mistakes" section at the end (2–3 bullets)

Target ~300–500 words. Plain Markdown only — do NOT wrap it in a code fence and do NOT return JSON.`,
    ].join('\n\n'),

  quiz: (topic, difficulty, sourceText) =>
    [
      'You are an assessment designer creating a multiple-choice quiz.',
      topicContext(topic, difficulty, sourceText),
      CONCISE_RULE,
      'Create a quiz of 5–8 multiple-choice questions that test understanding at the requested difficulty (mix of recall and application).',
      `Return ONLY a single JSON object — no prose, no markdown fences — in EXACTLY this shape:
{"questions":[{"question":"...","options":["A: ...","B: ...","C: ...","D: ..."],"correctAnswer":"A: ...","explanation":"one or two sentences"}]}

Rules:
- options is an array of exactly 4 strings.
- correctAnswer must exactly equal one of the options strings.
- explanations must teach, not just restate the right answer.
- the JSON must be valid and parseable by JSON.parse().`,
    ].join('\n\n'),

  plan: (topic, difficulty, sourceText) =>
    [
      'You are a learning designer creating a personalized day-by-day study plan.',
      topicContext(topic, difficulty, sourceText),
      CONCISE_RULE,
      `Build a study plan tailored to the ${difficulty.toLowerCase()} difficulty. Scale the plan length to the difficulty:
- Beginner: 4 days
- Intermediate: 5 days
- Advanced: 7 days`,
      `Return ONLY a single JSON object — no prose, no markdown fences — in EXACTLY this shape:
{"days":[{"day":1,"title":"Short title for the day","focused":true,"topics":["topic string",...],"tasks":["actionable task",...]}]}

Rules:
- Include 2–4 topics and 3–5 concrete tasks per day.
- Tasks must be specific and doable (practice, quiz yourself, build a mini-project, explain aloud, etc.).
- Progress through the material logically (foundations first).
- the JSON must be valid and parseable by JSON.parse().`,
    ].join('\n\n'),
};

export function systemPromptFor(
  mode: Mode | 'chat',
  topic: string,
  difficulty: Difficulty,
  sourceText?: string | null,
): string {
  const builder = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.chat;
  return builder(topic, difficulty, sourceText);
}

// ---------------------------------------------------------------------------
// JSON extraction helpers (defensive: the model sometimes wraps JSON in fences)

export function extractJson(text: string): string {
  const cleaned = text.trim();
  // Strip a ```json ... ``` fence if present
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  // Find the outermost {...} block as a last resort
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);

  return cleaned;
}

export function parseJsonArray<T>(text: string, fallbackKey?: string): T[] {
  const json = extractJson(text);
  const parsed = JSON.parse(json) as unknown;
  if (Array.isArray(parsed)) return parsed as T[];
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (fallbackKey && Array.isArray(record[fallbackKey])) return record[fallbackKey] as T[];
  }
  throw new Error('Model did not return the expected JSON array shape.');
}