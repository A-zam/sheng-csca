import type { Metadata } from 'next';
import { ReviewClient } from '@/components/ReviewClient';

export const metadata: Metadata = {
  title: 'Mistake bank and review',
  description:
    'Questions you answered wrongly come back on a spaced schedule — tomorrow, then at widening ' +
    'intervals for as long as you keep getting them right.',
  alternates: { canonical: '/review/' },
  openGraph: {
    title: 'Mistake bank and review — SHENG CSCA',
    description:
      'Spaced repetition for the CSCA questions you got wrong, so they come back until they stick.',
    url: '/review/',
  },
};

export default function ReviewPage() {
  return <ReviewClient />;
}
