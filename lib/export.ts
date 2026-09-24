import type { Note, Quiz, StudyPlan } from '@/lib/types';

export type ExportType = 'notes' | 'quiz' | 'plan';

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  );
}

export function exportTitle(topic: string, type: ExportType): string {
  switch (type) {
    case 'notes':
      return `Study Notes — ${topic}`;
    case 'quiz':
      return `Quiz — ${topic}`;
    case 'plan':
      return `Study Plan — ${topic}`;
  }
}

export function notesToMarkdown(note: Note): string {
  const content = note.content.trim();
  return content;
}

export function quizToMarkdown(quiz: Quiz): string {
  const lines: string[] = [];
  quiz.questions.forEach((q, i) => {
    lines.push(`### ${i + 1}. ${q.question.replace(/^#+\s*/, '')}`);
    q.options.forEach((opt) => lines.push(`- ${opt}`));
    lines.push('');
    lines.push(`> **Answer:** ${q.correctAnswer}`);
    lines.push(`> ${q.explanation}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function planToMarkdown(plan: StudyPlan): string {
  const lines: string[] = [];
  plan.content.forEach((day) => {
    lines.push(`## Day ${day.day}${day.title ? ` — ${day.title}` : ''}`);
    lines.push('');
    lines.push('**Topics:**');
    day.topics.forEach((t) => lines.push(`- ${t}`));
    lines.push('');
    lines.push('**Tasks:**');
    day.tasks.forEach((t) => lines.push(`- [ ] ${t}`));
    lines.push('');
  });
  return lines.join('\n');
}

export function buildMarkdown(
  topic: string,
  type: ExportType,
  note: Note | null,
  quiz: Quiz | null,
  plan: StudyPlan | null,
): { content: string; filename: string } | null {
  const header = `# ${exportTitle(topic, type)}\n\n`;
  const footer = `\n\n---\n*Exported from AI Study Assistant*`;

  if (type === 'notes' && note) return { content: header + notesToMarkdown(note) + footer, filename: `${slugify(topic)}-notes.md` };
  if (type === 'quiz' && quiz) return { content: header + quizToMarkdown(quiz) + footer, filename: `${slugify(topic)}-quiz.md` };
  if (type === 'plan' && plan) return { content: header + planToMarkdown(plan) + footer, filename: `${slugify(topic)}-study-plan.md` };
  return null;
}