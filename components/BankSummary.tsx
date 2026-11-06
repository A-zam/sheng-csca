'use client';

import { use } from 'react';
import { loadManifest } from '@/lib/data';
import { Boundary } from './Boundary';
import { Skeleton } from './ui';

/**
 * Reads the real bank counts from the manifest rather than hard-coding them,
 * so the home page cannot drift out of date as questions are added.
 */
export function BankSummary() {
  return (
    <Boundary
      fallback={
        <div className="mt-6 grid gap-10 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      }
      message="The question counts could not be loaded, but practice still works."
    >
      <BankSummaryInner />
    </Boundary>
  );
}

/** Shades of the blue ink, darkest first, so neighbouring areas stay apart. */
const SHADES = [100, 72, 48, 30, 18];

function BankSummaryInner() {
  const manifest = use(loadManifest());

  return (
    <div className="mt-6 grid gap-x-12 gap-y-10 sm:grid-cols-2">
      {manifest.subjects.map((subject) => {
        const rows = manifest.questions.filter((q) => q.s === subject.id);
        const topics = new Set(rows.map((q) => q.t)).size;
        const blueprint = manifest.paperBlueprint[subject.id];
        const strands = subject.strands.map((strand, index) => ({
          id: strand.id,
          name: strand.name,
          count: blueprint.byStrand[strand.id]?.total ?? 0,
          colour: `color-mix(in srgb, var(--brand) ${SHADES[index % SHADES.length]}%, var(--sheet))`,
        }));
        const total = strands.reduce((n, s) => n + s.count, 0) || 1;

        return (
          <div key={subject.id}>
            <h3 className="font-serif text-[21px] font-semibold text-[var(--ink)]">
              {subject.name}
            </h3>
            <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
              <span className="font-semibold text-[var(--ink)] tabular-nums">{rows.length}</span>{' '}
              questions to practise, across{' '}
              <span className="font-semibold text-[var(--ink)] tabular-nums">{topics}</span> topics.
              The paper is {subject.questionCount} questions in {subject.timeLimitMinutes} minutes,
              out of {subject.totalPoints}.
            </p>

            <div
              className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-[2px]"
              aria-hidden="true"
            >
              {strands.map((strand) => (
                <span
                  key={strand.id}
                  style={{ flexGrow: strand.count, background: strand.colour }}
                  className="h-full basis-0"
                />
              ))}
            </div>

            <ul className="mt-4 space-y-1.5 text-[15px]">
              {strands.map((strand) => (
                <li key={strand.id} className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[1px]"
                    style={{ background: strand.colour }}
                  />
                  <span className="min-w-0 flex-1 text-[var(--ink)]">{strand.name}</span>
                  <span className="shrink-0 text-[var(--ink-soft)] tabular-nums">
                    {strand.count} of {total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
