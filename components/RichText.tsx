'use client';

import { useMemo } from 'react';
import katex from 'katex';
import { paragraphs, tokenize, type TextToken } from '@/lib/latex-text';

/**
 * Renders question text: LaTeX in `$...$` and `$$...$$`, plus the small amount
 * of Markdown the content uses (`**bold**`, `*italic*`, blank-line paragraphs).
 *
 * The input is authored content from this repository, never anything a visitor
 * typed, so the rendered KaTeX HTML is safe to inject. Everything outside a
 * maths span goes through React as text and is escaped as usual.
 */

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: 'htmlAndMathml',
      trust: false,
    });
  } catch {
    // throwOnError:false covers parse errors; this is the belt-and-braces case.
    return `<span class="katex-error">${escapeHtml(tex)}</span>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `**bold**` and `*italic*` inside a plain-text run. */
function renderInlineMarkup(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    n += 1;
    if (token.startsWith('**')) {
      out.push(
        <strong key={`${keyPrefix}-b${n}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <em key={`${keyPrefix}-i${n}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface RichTextProps {
  children: string;
  /** Render as a single line, with no paragraph splitting. Used for options. */
  inline?: boolean;
  className?: string;
}

export function RichText({ children, inline = false, className }: RichTextProps) {
  const blocks = useMemo(() => {
    const source = children ?? '';
    const blocksOfText = inline ? [source] : paragraphs(source);
    return blocksOfText.map((paragraph) => tokenize(paragraph));
  }, [children, inline]);

  const renderTokens = (tokens: TextToken[], prefix: string) =>
    tokens.map((token, index) => {
      const key = `${prefix}-${index}`;
      if (token.kind === 'math') {
        const html = renderMath(token.value, token.display);
        return token.display ? (
          <span key={key} className="block" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span key={key} dangerouslySetInnerHTML={{ __html: html }} />
        );
      }
      return (
        <span key={key}>
          {token.value.split('\n').flatMap((line, lineIndex, lines) => {
            const nodes: React.ReactNode[] = renderInlineMarkup(line, `${key}-${lineIndex}`);
            if (lineIndex < lines.length - 1) nodes.push(<br key={`${key}-br${lineIndex}`} />);
            return nodes;
          })}
        </span>
      );
    });

  if (inline) {
    return <span className={className}>{renderTokens(blocks[0] ?? [], 'i')}</span>;
  }

  return (
    <div className={className}>
      {blocks.map((tokens, index) => (
        <p key={index} className={index === 0 ? '' : 'mt-3'}>
          {renderTokens(tokens, `p${index}`)}
        </p>
      ))}
    </div>
  );
}
