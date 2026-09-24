'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Tiny Markdown → React renderer.
 * Renders headings, lists, fenced/inline code, bold, italic, links, quotes
 * and horizontal rules. No dangerouslySetInnerHTML — output is always escaped.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize: code spans, bold, italic, links — then plain text.
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    const token = match[0];
    const key = `${keyPrefix}-e${i++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-slate-200/70 px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const href = linkMatch[2].startsWith('http') ? linkMatch[2] : '#';
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={key}>{token}</Fragment>);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return nodes;
}

function isFence(line: string): boolean {
  return /^\s*```/.test(line);
}

function isHeading(line: string): boolean {
  return /^#{1,4}\s+/.test(line);
}

function isQuote(line: string): boolean {
  return /^\s*>\s?/.test(line);
}

function isHr(line: string): boolean {
  return /^\s*([-*_])\1{2,}\s*$/.test(line);
}

function isBullet(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line);
}

function isOrdered(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

interface ListGroup {
  ordered: boolean;
  items: { text: string; nested?: string[] }[];
}

export function Markdown({ content, className = '' }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trim = line.trim();

    if (!trim) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (isFence(line)) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <pre key={`b${blockIndex++}`} className="rounded-lg bg-slate-900 p-3 text-[0.82rem] leading-relaxed text-slate-100">
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    if (isHeading(line)) {
      const level = line.match(/^(#{1,4})/)?.[1].length ?? 2;
      const text = trim.replace(/^#{1,4}\s+/, '');
      const Tag = (`h${Math.min(level, 4)}`) as 'h1' | 'h2' | 'h3' | 'h4';
      const size =
        level === 1 ? 'text-base font-semibold' : level === 2 ? 'text-[0.95rem] font-semibold' : 'text-[0.9rem] font-semibold';
      blocks.push(
        <Tag key={`b${blockIndex++}`} className={`mb-1 mt-3 first:mt-0 ${size}`}>
          {renderInline(text, `h${blockIndex}`)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    // Quote
    if (isQuote(line)) {
      const buf: string[] = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={`b${blockIndex++}`} className="my-2 rounded-r-lg border-l-3 border-indigo-300 bg-indigo-50/60 py-1 pl-3 pr-2 text-slate-600">
          {buf.map((q, qi) => (
            <p key={qi} className={qi > 0 ? 'mt-1' : ''}>
              {renderInline(q, `q${blockIndex}-${qi}`)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Horizontal rule
    if (isHr(line)) {
      blocks.push(<hr key={`b${blockIndex++}`} className="my-3 border-slate-200" />);
      i += 1;
      continue;
    }

    // List
    if (isBullet(line) || isOrdered(line)) {
      const ordered = isOrdered(line);
      const groups: ListGroup[] = [];
      while (i < lines.length) {
        const current = lines[i];
        if (!current.trim()) break;
        if (isBullet(current) || isOrdered(current)) {
          const itemText = current.replace(/^\s*([-*+]|\d+[.)])\s+/, '');
          const indent = current.match(/^\s*/)?.[0].length ?? 0;
          const group = groups[groups.length - 1];
          if (!group || (isOrdered(current) !== group.ordered) || (indent > 0 && group.items.length === 0)) {
            // start (or continue) a group matching this line's type
            const target = groups.find((g) => g.ordered === isOrdered(current));
            if (target) target.items.push({ text: itemText });
            else groups.push({ ordered: isOrdered(current), items: [{ text: itemText }] });
          } else {
            group.items.push({ text: itemText });
          }
          i += 1;
          continue;
        }
        if (/^\s{2,}\S/.test(current) && groups.length > 0) {
          // sibling continuation line
          groups[groups.length - 1].items[groups[groups.length - 1].items.length - 1].text += ` ${current.trim()}`;
          i += 1;
          continue;
        }
        break;
      }
      blocks.push(
        <div key={`b${blockIndex++}`} className="my-1.5">
          {groups.map((group, gi) => {
            const Tag = group.ordered ? 'ol' : 'ul';
            return (
              <Tag key={gi} className={`my-1 list-inside ${group.ordered ? 'list-decimal' : 'list-disc'} pl-1`}>
                {group.items.map((item, ii) => (
                  <li key={ii} className="my-0.5 pl-1">
                    {renderInline(item.text, `li${blockIndex}-${gi}-${ii}`)}
                  </li>
                ))}
              </Tag>
            );
          })}
        </div>,
      );
      continue;
    }

    // Paragraph (collect consecutive plain lines)
    const para: string[] = [trim];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isHeading(lines[i]) && !isFence(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`b${blockIndex++}`} className="my-1 leading-relaxed">
        {renderInline(para.join(' '), `p${blockIndex}`)}
      </p>,
    );
  }

  return <div className={`prose-md ${className}`}>{blocks}</div>;
}