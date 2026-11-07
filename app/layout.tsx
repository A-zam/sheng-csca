import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Next, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { DISCLAIMER, NAV, SITE } from '@/lib/site';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavLinks } from '@/components/NavLinks';

/**
 * Two faces. Source Serif 4 is the exam paper: question stems, headings, the
 * clock. Atkinson Hyperlegible Next is everything you operate, chosen because
 * it was drawn to keep similar letters apart, which matters to a reader working
 * in a second language on a small screen. Both are downloaded at build time and
 * served from this site, so visiting it contacts no font host.
 */
const paper = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-paper',
  display: 'swap',
  axes: ['opsz'],
});

const ui = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
  // next/font has no fallback metrics for this family yet, so name the
  // fallback directly instead of letting it warn on every build.
  adjustFontFallback: false,
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'CSCA',
    'CSCA exam',
    'CSCA mathematics',
    'CSCA physics',
    'study in China',
    'China Scholastic Competency Assessment',
    'practice questions',
    'mock exam',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef2ec' },
    { media: '(prefers-color-scheme: dark)', color: '#121a2b' },
  ],
};

/**
 * Runs before first paint so the page never flashes the wrong theme.
 * Wrapped in try/catch because reading localStorage throws in some privacy
 * modes, and a theme preference is not worth a blank page.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('csca-prep:theme');
    var dark = stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${paper.variable} ${ui.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-[var(--brand)] focus:px-4 focus:py-2 focus:text-[var(--sheet)]"
        >
          Skip to content
        </a>

        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/92 backdrop-blur-sm">
            {/* Two rows on a phone (name, then the four sections), one row from sm up.
                Its height is --header-h, which the mock exam's sticky clock sits under. */}
            <div className="mx-auto flex h-[var(--header-h)] max-w-5xl flex-wrap items-center gap-x-4 px-4 sm:flex-nowrap sm:px-6">
              <Link
                href="/"
                className="flex h-12 shrink-0 items-center gap-2 text-[var(--ink)] sm:h-auto"
              >
                <Wordmark />
                <span className="font-serif text-[18px] font-semibold tracking-[0.04em]">
                  SHENG CSCA
                </span>
              </Link>
              <NavLinks items={NAV} />
              <ThemeToggle />
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
            {children}
          </main>

          <footer className="mt-auto border-t border-[var(--line)] bg-[var(--paper)]">
            <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8 text-[14px] leading-relaxed text-[var(--ink-soft)] sm:grid-cols-[1fr_auto] sm:px-6">
              <p className="max-w-[62ch]">{DISCLAIMER}</p>
              <p className="sm:text-right">
                No accounts and no tracking.
                <br className="hidden sm:inline" /> Progress stays in this browser.{' '}
                <Link
                  href="/about"
                  className="text-[var(--brand)] underline decoration-1 underline-offset-[3px] hover:text-[var(--ink)]"
                >
                  About and privacy
                </Link>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

/** One answer-card bubble, filled in: the site's mark. */
function Wordmark() {
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true" className="shrink-0">
      <rect
        x="1"
        y="1"
        width="24"
        height="14"
        rx="7"
        fill="var(--graphite)"
        stroke="var(--pen)"
        strokeWidth="1.5"
      />
      <text
        x="13"
        y="11.6"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="var(--sheet)"
        fontFamily="var(--font-ui), sans-serif"
      >
        S
      </text>
    </svg>
  );
}
