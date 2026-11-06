import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui';
import { LINK } from '@/components/styles';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="max-w-[40rem] py-4">
      <h1 className="font-serif text-[40px] leading-[1.1] font-semibold tracking-[-0.01em] text-[var(--ink)] sm:text-[48px]">
        That page is not here
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">
        The link may be out of date, or there may be a typo in the address. Your saved progress is
        untouched: it lives in this browser, not on the page you were trying to reach.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/practice">Go to practice</ButtonLink>
        <ButtonLink href="/" tone="secondary">
          Back to the start
        </ButtonLink>
      </div>

      <h2 className="mt-12 font-serif text-[21px] font-semibold text-[var(--ink)]">
        Everything on this site
      </h2>
      <ul className="mt-3 grid gap-2 text-[16px] sm:grid-cols-2">
        {[
          ['/practice', 'Practice by topic'],
          ['/mock', 'Timed mock exam'],
          ['/review', 'Mistake bank and review'],
          ['/progress', 'Your progress'],
          ['/about', 'About and privacy'],
        ].map(([href, label]) => (
          <li key={href}>
            <a href={href} className={LINK}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
