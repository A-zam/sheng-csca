'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: Route;
  label: string;
}

export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="order-last -mx-2 min-w-0 basis-full sm:order-none sm:mx-0 sm:flex-1 sm:basis-auto"
    >
      {/* Scrolls sideways on a narrow phone rather than wrapping the header. */}
      <ul className="flex h-10 items-center justify-between gap-0.5 overflow-x-auto text-[15px] [scrollbar-width:none] sm:h-auto sm:justify-start sm:gap-2 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = pathname === item.href || pathname === item.href.replace(/\/$/, '');
          return (
            <li key={item.href} className="shrink-0">
              {/* The current page is underlined in red pen, as a teacher would mark it. */}
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'block px-2 py-1.5 font-semibold text-[var(--ink)] underline decoration-[var(--pen)] decoration-2 underline-offset-[7px]'
                    : 'block px-2 py-1.5 text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]'
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
