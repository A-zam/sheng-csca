/** One place for the strings that appear in metadata, the footer and /about. */

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  // Injected by Vercel when "Automatically expose System Environment
  // Variables" is on, which is the default for a Next.js project. It carries
  // no protocol.
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export const SITE = {
  name: 'SHENG CSCA',
  tagline: 'Free CSCA Mathematics and Physics practice, in English',
  description:
    'Practice questions, timed mock exams and a spaced-repetition mistake bank for the ' +
    'CSCA Mathematics and Physics papers. Free, no account, nothing tracked.',
  /**
   * The origin used for canonical links, Open Graph tags and sitemap.xml.
   *
   * Falls back to the project's stable production domain, which Vercel injects
   * at build time, so a deployment gets correct URLs without anyone setting
   * anything. Note this is the *production* domain, not VERCEL_URL — that one
   * changes on every deployment and would make canonical links churn.
   *
   * Set NEXT_PUBLIC_SITE_URL to override, which is what a custom domain needs.
   */
  url: resolveSiteUrl(),
  locale: 'en',
  /** Where "report a problem with this question" goes. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
  /** If set, question reports open a prefilled GitHub issue instead of a mailto. */
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL ?? '',
} as const;

export const DISCLAIMER =
  'This is an independent study resource. It is not affiliated with, endorsed by, or ' +
  'connected to CSCA, the China Scholarship Council, or any university. Question content ' +
  'here is original and written for practice; it is not past-paper material.';

export const PRIVACY_NOTE =
  'There are no accounts and no tracking. Your answers, your mistake bank and your progress ' +
  'are stored only in this browser, using localStorage, and are never sent anywhere. Clearing ' +
  'your browser data clears your progress, and opening the site on another device starts fresh.';

/**
 * Build the "report a problem" link for one question. Prefers a GitHub issue,
 * falls back to a mailto, and returns null when neither is configured so the
 * UI can hide the link rather than render a dead one.
 */
export function reportLink(questionId: string, pageUrl: string): string | null {
  const title = `Question problem: ${questionId}`;
  const body = [
    `Question ID: ${questionId}`,
    `Page: ${pageUrl}`,
    '',
    'What looks wrong?',
    '',
    '',
    '(For example: the marked answer is wrong, the maths does not render, ' +
      'two options are both correct, the wording is unclear.)',
  ].join('\n');

  if (SITE.repoUrl) {
    const base = SITE.repoUrl.replace(/\/$/, '');
    return `${base}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }
  if (SITE.contactEmail) {
    return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }
  return null;
}

export const NAV = [
  { href: '/practice', label: 'Practice' },
  { href: '/mock', label: 'Mock exam' },
  { href: '/review', label: 'Review' },
  { href: '/progress', label: 'Progress' },
] as const;
