import type { Metadata } from 'next';
import { ProgressClient } from '@/components/ProgressClient';

export const metadata: Metadata = {
  title: 'Your progress',
  description:
    'Accuracy by topic, attempts over the last month, your weakest high-value topics, and a ' +
    'readiness estimate against a target score you set.',
  alternates: { canonical: '/progress/' },
  openGraph: {
    title: 'Your progress — SHENG CSCA',
    description:
      'Accuracy by topic, activity over the last month, and a readiness estimate against your ' +
      'target CSCA score.',
    url: '/progress/',
  },
};

export default function ProgressPage() {
  return <ProgressClient />;
}
