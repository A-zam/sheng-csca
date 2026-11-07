import type { Metadata } from 'next';
import { MockClient } from '@/components/MockClient';

export const metadata: Metadata = {
  title: 'Timed mock exam',
  description:
    'Sit a full CSCA mock paper: 48 questions in 60 minutes, built to the real mix of topics ' +
    'and difficulty, with a per-topic breakdown when you submit.',
  alternates: { canonical: '/mock/' },
  openGraph: {
    title: 'Timed mock exam — SHENG CSCA',
    description:
      'A full CSCA mock paper under exam conditions: 48 questions, 60 minutes, scored with a ' +
      'per-topic breakdown.',
    url: '/mock/',
  },
};

export default function MockPage() {
  return <MockClient />;
}
