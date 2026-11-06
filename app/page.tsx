import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ButtonLink, Kbd } from '@/components/ui';
import { AnswerCard } from '@/components/AnswerCard';
import { BankSummary } from '@/components/BankSummary';
import { ResumeBanner } from '@/components/ResumeBanner';
import { LINK } from '@/components/styles';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: '/',
  },
};

const WAYS: Array<{ href: Route; title: string; body: string }> = [
  {
    href: '/practice',
    title: 'Practise by topic',
    body: 'Choose a subject, a topic and a difficulty. Answer one question at a time and read the worked solution as soon as you commit.',
  },
  {
    href: '/mock',
    title: 'Sit a timed mock',
    body: 'A full 48-question paper in 60 minutes, built to the real mix of topics and difficulty. Nothing is marked until you hand it in.',
  },
  {
    href: '/review',
    title: 'Clear your mistakes',
    body: 'Every question you get wrong comes back the next day, then at longer and longer gaps until you have it for good.',
  },
  {
    href: '/progress',
    title: 'See where the marks are',
    body: 'Accuracy by topic, weighted by how much of the paper each topic fills, and an estimate against the score you are aiming for.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_32rem] lg:gap-14">
        <div className="max-w-[34rem] lg:pt-4">
          <h1 className="font-serif text-[40px] leading-[1.06] font-semibold tracking-[-0.015em] text-[var(--ink)] sm:text-[54px]">
            48 questions in 60 minutes. Practise until that feels like plenty.
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed text-[var(--ink-soft)]">
            Free CSCA Mathematics and Physics practice, in English. That pace gives you about 75
            seconds a question, so this site trains the speed as much as the content.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/practice">Start practising</ButtonLink>
            <ButtonLink href="/mock" tone="secondary">
              Sit a timed mock
            </ButtonLink>
          </div>
          <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
            No sign-up. Your first question is one click away.
          </p>
        </div>

        <div>
          <AnswerCard />
          <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
            The mock exam gives you this same card to move around the paper.
          </p>
        </div>
      </section>

      <ResumeBanner />

      <section className="mt-16 sm:mt-20" aria-labelledby="ways">
        <h2
          id="ways"
          className="font-serif text-[28px] leading-tight font-semibold text-[var(--ink)]"
        >
          Four ways to use it
        </h2>
        <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
          {WAYS.map((way) => (
            <li key={way.href} className="border-t border-[var(--line)] py-5">
              <Link
                href={way.href}
                className="font-serif text-[21px] font-semibold text-[var(--brand)] underline decoration-[var(--brand)]/30 decoration-1 underline-offset-4 hover:decoration-[var(--brand)]"
              >
                {way.title}
              </Link>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
                {way.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="bank">
        <h2
          id="bank"
          className="font-serif text-[28px] leading-tight font-semibold text-[var(--ink)]"
        >
          What each paper covers
        </h2>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
          Each bar is one paper, split by how many of its 48 questions come from each area. The mock
          exam uses the same split.
        </p>
        <BankSummary />
      </section>

      <section
        className="mt-14 rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] p-5 sm:p-8"
        aria-labelledby="before"
      >
        <h2
          id="before"
          className="font-serif text-[24px] leading-tight font-semibold text-[var(--ink)]"
        >
          Before you start
        </h2>
        <dl className="mt-5 grid gap-x-10 gap-y-5 text-[15px] leading-relaxed sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-[var(--ink)]">Your progress stays on this device</dt>
            <dd className="mt-1 text-[var(--ink-soft)]">
              It is saved in this browser and never sent anywhere. Use the same browser to keep it;
              a different phone or laptop starts fresh.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Physics uses g = 10 m/s²</dt>
            <dd className="mt-1 text-[var(--ink-soft)]">
              That is what the exam papers use, and it is written into every question where it
              matters.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Answer from the keyboard</dt>
            <dd className="mt-1 text-[var(--ink-soft)]">
              Press <Kbd>1</Kbd> to <Kbd>4</Kbd> to choose an answer and <Kbd>Enter</Kbd> to move
              on.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--ink)]">Nothing here is a past paper</dt>
            <dd className="mt-1 text-[var(--ink-soft)]">
              Every question is written for this site, modelled on the published exam format.{' '}
              <Link href="/about" className={LINK}>
                How the questions are made
              </Link>
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
