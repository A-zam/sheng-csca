import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeading } from '@/components/ui';
import { StorageFootprint } from '@/components/StorageFootprint';
import { LINK } from '@/components/styles';
import { DISCLAIMER, PRIVACY_NOTE, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About and privacy',
  description:
    'What this site is, where the question content comes from, why it is not affiliated with ' +
    'CSCA, and exactly what is stored in your browser.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About and privacy — CSCA Prep',
    description:
      'What this site is, where the questions come from, and exactly what is stored in your browser.',
    url: '/about',
  },
};

/** One part of the page: a serif heading and prose set to a reading measure. */
function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-[var(--line)] pt-6">
      <h2 id={id} className="font-serif text-[24px] leading-tight font-semibold text-[var(--ink)]">
        {title}
      </h2>
      <div className="mt-3 max-w-[66ch] space-y-3 text-[16px] leading-[1.65] text-[var(--ink-soft)]">
        {children}
      </div>
    </section>
  );
}

const CODE =
  'rounded-[3px] bg-[var(--paper-sunk)] px-1 py-0.5 font-mono text-[14px] text-[var(--ink)]';

export default function AboutPage() {
  return (
    <>
      <PageHeading
        title="About this site"
        lead="What it is, where the questions come from, and exactly what it keeps in your browser."
      />

      <article className="space-y-10 rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] px-5 py-8 sm:px-10 sm:py-10 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
        <Part id="affiliation" title="Not affiliated with CSCA">
          <p>{DISCLAIMER}</p>
          <p>
            For anything official, such as registration, dates, fees, the official syllabus or what
            your university requires, go to CSCA and to the university directly. Nothing here is a
            substitute for that.
          </p>
        </Part>

        <Part id="privacy" title="Privacy">
          <p>{PRIVACY_NOTE}</p>
          <p>
            There is no analytics script, no advertising, no cookies and no third-party embed. The
            fonts are served from this site too. It is all static files, and you can confirm that in
            your browser&rsquo;s network tab.
          </p>
          <StorageFootprint />
        </Part>

        <Part id="questions" title="Where the questions come from">
          <p>
            Every question is written for this site. None is a past paper, a translation of one, or
            a reworded copy of one. They follow the published exam format: the question count, the
            time limit, the topic mix and the spread of difficulty. The scenarios, the numbers and
            the wording are all original.
          </p>
          <p>
            That is enforced rather than promised. An automated check compares every published stem
            and solution against the reference material used to build the topic profile, and flags
            any run of eight or more words in common. Numbers are ignored during the comparison, so
            swapping quantities does not get past it. Flagged questions are rewritten before they
            ship.
          </p>
        </Part>

        <Part id="answers" title="How the answers are checked">
          <p>
            A wrong answer key is worse than a missing question, so every quantitative answer is
            recomputed by code before it can ship. The check derives the answer from the numbers in
            the question, compares it against the marked option, and fails if any other option
            carries the same value. Answers that are expressions or intervals are checked by
            sampling all four options and confirming exactly one matches.
          </p>
          <p>
            None of that makes the bank perfect. If something looks wrong, the link under any
            answered question reports it.
          </p>
        </Part>

        <Part id="conventions" title="Two conventions worth knowing">
          <p>
            <strong className="font-semibold text-[var(--ink)]">Physics uses g = 10 m/s².</strong>{' '}
            That is what the exam papers use. The value is written into every question where it
            matters, so nothing depends on you guessing it.
          </p>
          <p>
            <strong className="font-semibold text-[var(--ink)]">No penalty for guessing.</strong>{' '}
            Nothing published suggests the exam deducts marks for a wrong answer, and no paper we
            have seen does. Scoring here is one mark per correct answer and nothing otherwise, so
            leaving a question blank is never better than guessing.
          </p>
        </Part>

        <Part id="exam" title="The exam itself">
          <p>
            Mathematics and Physics are each 48 multiple-choice questions in 60 minutes, scored out
            of 100. That is about 75 seconds a question, which is the real constraint: the questions
            are not individually hard, but there is no time to be slow. Mathematics is required for
            every applicant. Physics is required for engineering, computer science and physical
            science programmes. Both can be taken in English.
          </p>
          <p>Always confirm the current requirements with the university you are applying to.</p>
        </Part>

        <Part id="report" title="Something wrong?">
          <p>
            {SITE.repoUrl || SITE.contactEmail ? (
              <>
                Every answered question has a &ldquo;report a problem&rdquo; link that opens a
                prefilled report with the question&rsquo;s id. That is the fastest way to get a bad
                question fixed.
              </>
            ) : (
              <>
                Reporting is not configured on this deployment yet. Set{' '}
                <code className={CODE}>NEXT_PUBLIC_REPO_URL</code> or{' '}
                <code className={CODE}>NEXT_PUBLIC_CONTACT_EMAIL</code> and the link appears under
                every answered question.
              </>
            )}
          </p>
        </Part>
      </article>

      <p className="mt-8 text-[16px]">
        <Link href="/practice" className={LINK}>
          Back to practice
        </Link>
      </p>
    </>
  );
}
