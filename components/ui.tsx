'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ sheet */

/**
 * A printed sheet laid on the squared paper. Corners are barely rounded and
 * there is no shadow: it is paper on paper, not a floating panel.
 */
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag
      className={cx(
        'rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] p-4 sm:p-6',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ----------------------------------------------------------------- button */

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';

const TONES: Record<ButtonTone, string> = {
  primary:
    'bg-[var(--brand)] text-[var(--sheet)] hover:brightness-115 active:brightness-95 ' +
    'disabled:bg-[var(--line)] disabled:text-[var(--ink-soft)]',
  secondary:
    'border border-[var(--ink-soft)]/45 bg-[var(--sheet)] text-[var(--ink)] ' +
    'hover:border-[var(--ink)] disabled:text-[var(--ink-soft)]',
  ghost: 'text-[var(--ink-soft)] hover:bg-[var(--paper-sunk)] hover:text-[var(--ink)]',
  danger:
    'border border-[var(--bad)] text-[var(--bad)] hover:bg-[var(--bad-soft)] disabled:opacity-50',
};

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] px-4 py-2 text-[15px] font-semibold ' +
  'transition-[filter,background-color,border-color,color] disabled:cursor-not-allowed';

export function Button({
  tone = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { tone?: ButtonTone }) {
  return <button {...props} className={cx(BUTTON_BASE, TONES[tone], className)} />;
}

export function ButtonLink({
  tone = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { tone?: ButtonTone }) {
  return <Link {...props} className={cx(BUTTON_BASE, TONES[tone], className)} />;
}

/* ------------------------------------------------------------------ badge */

type BadgeTone = 'neutral' | 'brand' | 'good' | 'bad' | 'warn';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--paper-sunk)] text-[var(--ink-soft)]',
  brand: 'bg-[var(--brand-soft)] text-[var(--brand)]',
  good: 'bg-[var(--good-soft)] text-[var(--good)]',
  bad: 'bg-[var(--bad-soft)] text-[var(--bad)]',
  warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-[13px] leading-tight font-semibold whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- bubble */

export type BubbleState = 'empty' | 'filled' | 'correct' | 'wrong' | 'struck';

/**
 * One answer-card bubble: a pill printed in red ink with its letter inside,
 * filled in graphite once chosen. Used for the answer options, the mock exam's
 * answer card and the home page.
 */
export function Bubble({
  letter,
  state = 'empty',
  size = 'md',
  className,
  style,
}: {
  letter: string;
  state?: BubbleState;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] font-semibold tabular-nums',
        size === 'sm' ? 'h-[15px] w-[23px] text-[9.5px]' : 'h-7 w-10 text-[13px]',
        state === 'filled'
          ? 'border-[var(--graphite)] bg-[var(--graphite)] text-[var(--sheet)]'
          : state === 'correct'
            ? 'border-[var(--good)] bg-[var(--good)] text-[var(--sheet)]'
            : state === 'wrong'
              ? 'border-[var(--bad)] bg-[var(--bad)] text-[var(--sheet)]'
              : state === 'struck'
                ? 'border-[var(--bad)]/40 text-[var(--bad)]/60 line-through decoration-2'
                : 'border-[var(--pen)]/70 text-[var(--pen)]',
        className,
      )}
    >
      {letter}
    </span>
  );
}

/* --------------------------------------------------------------- figures */

/**
 * A row of headline numbers, set like the totals at the foot of a marked
 * paper: the figure large in the serif, what it counts beneath it in plain
 * words. Replaces a grid of identical stat cards.
 */
export function Figures({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; note?: string }>;
  className?: string;
}) {
  return (
    <dl
      className={cx(
        'grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--line)] py-5 sm:flex sm:flex-wrap sm:gap-x-0',
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cx(
            'flex flex-col-reverse sm:min-w-[9rem] sm:px-6',
            index === 0 ? 'sm:pl-0' : 'sm:border-l sm:border-[var(--line)]',
          )}
        >
          <dt className="mt-1 text-[14px] text-[var(--ink-soft)]">
            {item.label}
            {item.note ? (
              <span className="block text-[13px] text-[var(--ink-soft)]/85">{item.note}</span>
            ) : null}
          </dt>
          <dd className="font-serif text-[36px] leading-none font-semibold text-[var(--ink)] tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ----------------------------------------------------------------- select */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-[var(--ink)]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[13px] text-[var(--ink-soft)]">{hint}</span> : null}
    </label>
  );
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <span className="relative block">
      <select
        {...props}
        className={cx(
          'min-h-11 w-full appearance-none rounded-[5px] border border-[var(--ink-soft)]/45 bg-[var(--sheet)] py-2 pr-9 pl-3',
          'text-[15px] text-[var(--ink)] transition-colors hover:border-[var(--ink)]',
          className,
        )}
      />
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--ink-soft)]"
      >
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ state */

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed py-10 text-center sm:py-12">
      <h2 className="font-serif text-[24px] leading-tight font-semibold text-[var(--ink)]">
        {title}
      </h2>
      {children ? (
        <div className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('animate-pulse rounded-[3px] bg-[var(--paper-sunk)]', className)}
    />
  );
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <span className="sr-only">Loading</span>
      <Skeleton className="h-5 w-2/3" />
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <Card className="border-[var(--bad)] bg-[var(--bad-soft)]">
      <p className="text-[15px] text-[var(--bad)]">{children}</p>
    </Card>
  );
}

/** A note pinned above the work: a warning, or something waiting for you. */
export function Notice({
  tone = 'brand',
  children,
  action,
  className,
}: {
  tone?: 'brand' | 'warn';
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[3px] border-l-4 px-4 py-3',
        tone === 'warn'
          ? 'border-[var(--highlight)] bg-[var(--warn-soft)]'
          : 'border-[var(--brand)] bg-[var(--brand-soft)]',
        className,
      )}
    >
      <div className="min-w-[min(100%,20rem)] flex-1 text-[15px] text-[var(--ink)]">{children}</div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- progress */

export function Meter({
  value,
  max = 1,
  tone = 'brand',
  className,
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'good' | 'bad' | 'warn';
  className?: string;
}) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  const colour =
    tone === 'good'
      ? 'var(--good)'
      : tone === 'bad'
        ? 'var(--bad)'
        : tone === 'warn'
          ? 'var(--highlight)'
          : 'var(--brand)';
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-[var(--paper-sunk)]', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: colour }}
      />
    </div>
  );
}

export function PageHeading({
  title,
  lead,
  aside,
}: {
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[36px] leading-[1.1] font-semibold tracking-[-0.01em] text-[var(--ink)] sm:text-[48px]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-[var(--ink-soft)]">
            {lead}
          </p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

/** A section heading inside a page. */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cx(
        'font-serif text-[24px] leading-tight font-semibold text-[var(--ink)]',
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-b-2 border-[var(--line)] bg-[var(--sheet)] px-1.5 py-px font-sans text-[13px] font-semibold text-[var(--ink)]">
      {children}
    </kbd>
  );
}
