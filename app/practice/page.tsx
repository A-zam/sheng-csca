import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PracticeClient } from '@/components/PracticeClient';
import { LoadingCard } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Practice by topic',
  description:
    'Work through CSCA Mathematics and Physics questions one at a time. Filter by topic and ' +
    'difficulty, and read a full worked solution after every answer.',
  alternates: { canonical: '/practice/' },
  openGraph: {
    title: 'Practice by topic — SHENG CSCA',
    description:
      'Filter CSCA Mathematics and Physics questions by topic and difficulty, with a worked ' +
      'solution after every answer.',
    url: '/practice/',
  },
};

export default function PracticePage() {
  return (
    <Suspense fallback={<LoadingCard lines={4} />}>
      <PracticeClient />
    </Suspense>
  );
}
