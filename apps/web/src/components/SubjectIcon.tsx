import type { ReactNode, SVGProps } from 'react'
import { BookIcon } from './icons.tsx'

const dot = (cx: number, cy: number, r = 0.6) => <circle cx={cx} cy={cy} r={r} fill="currentColor" />

/**
 * Pictures for each subject, drawn in the same line style as the menu icons. Each subject
 * has several, so the Home banner can pick a different one on each visit: Maths may be the
 * four operations, pi, a right-angled triangle or a graph; Physics an atom, a lightning bolt,
 * a magnet, a wave or a planet. A subject without any falls back to the plain book.
 */
export const SUBJECT_ICONS: Record<string, ReactNode[]> = {
  maths: [
    <><path d="M7 3.5v7M3.5 7h7M13.5 7h7M4.5 14.5l5 5M9.5 14.5l-5 5M13.5 17h7" />{dot(17, 14)}{dot(17, 20)}</>,
    <path d="M4 7.5c1-1.5 2.5-2 4-2h12M9 5.5V19M15 5.5v10.5a3 3 0 0 0 3 3" />,
    <path d="M4 20h16L4 5zM4 16h4v4" />,
    <path d="M4 3.5V20h16.5M6.5 17c4 0 5.5-10 12.5-11" />,
  ],
  'further-maths': [
    <path d="M2.5 13h3l3.5 7.5L14 3.5h7.5" />,
    <path d="M16.5 4.5c-1.2-1.4-3.7-1-4 1.7l-1.3 11.6c-.3 2.7-2.8 3.1-4 1.7" />,
    <path d="M18 5H6l6.5 7L6 19h12" />,
    <><path d="M7 4H4v16h3M17 4h3v16h-3" />{dot(9.5, 9, 1)}{dot(14.5, 9, 1)}{dot(9.5, 15, 1)}{dot(14.5, 15, 1)}</>,
  ],
  physics: [
    <>{dot(12, 12, 1.3)}<ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" /></>,
    <path d="M13 2L4.5 13.5h6.5l-1 8.5 8.5-11.5H12z" />,
    <path d="M5.5 3v9a6.5 6.5 0 0 0 13 0V3h-4.5v9a2 2 0 0 1-4 0V3zM5.5 7.5H10M14 7.5h4.5" />,
    <path d="M2 12c2-5.5 4-5.5 6 0s4 5.5 6 0 4-5.5 6 0" />,
    <><circle cx="12" cy="12" r="5" /><ellipse cx="12" cy="12" rx="10.5" ry="3.5" transform="rotate(-20 12 12)" /></>,
  ],
  chemistry: [
    <path d="M9 3h6M10 3v6.5L4.4 18.9A1.4 1.4 0 0 0 5.6 21h12.8a1.4 1.4 0 0 0 1.2-2.1L14 9.5V3M7 15h10" />,
    <path d="M8.5 3h7M9.5 3v14.5a2.5 2.5 0 0 0 5 0V3M9.5 12h5" transform="rotate(20 12 12)" />,
    <><circle cx="6" cy="17" r="2.5" /><circle cx="12" cy="6.5" r="2.5" /><circle cx="18" cy="17" r="2.5" /><path d="M7.3 14.8l3.4-6M13.3 8.8l3.4 6M8.5 17h7" /></>,
    <><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><circle cx="12" cy="12" r="3.5" /></>,
  ],
  biology: [
    <path d="M5 19C5 10.5 11 4 20 4c0 9-6.5 15-15 15zM5 19l9-9" />,
    <path d="M7 3c0 6 10 12 10 18M17 3c0 6-10 12-10 18M8.5 6.5h7M10.5 9.5h3M10.5 14.5h3M8.5 17.5h7" />,
    <><ellipse cx="12" cy="12" rx="9.5" ry="7" /><circle cx="13" cy="11" r="2.5" />{dot(7.5, 13.5, 0.9)}{dot(16.5, 15, 0.9)}</>,
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  ],
  'computer-science': [
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
    <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>,
    <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 10l3 2.5L7 15M12.5 15.5h4.5" /></>,
    <><path d="M5 8l2.5-2V18" /><ellipse cx="16" cy="12" rx="3.5" ry="6" /></>,
  ],
  business: [
    <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></>,
    <path d="M3 20h18M5 16l4-4 4 3 6-7M15 8h4v4" />,
    <><circle cx="12" cy="12" r="9" /><path d="M14.5 8.5a2.5 2.5 0 0 0-4.5 1.5v6.5M8.5 13h4.5M8.5 16.5h7" /></>,
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  ],
  french: [
    <path d="M12 2v3M8 21c2-4.5 3-10 3.5-16h1c.5 6 1.5 11.5 3.5 16M9.6 12h4.8M6.5 21h11M10 21a2 2 0 0 1 4 0" />,
    <path d="M4 5h16v11h-8.5L6 20v-4H4zM8 9.5h8M8 12.5h5" />,
    <><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M9 5v14M15 5v14" /><path d="M4.5 6.5H9v11H4.5z" fill="currentColor" stroke="none" /></>,
    <path d="M4.5 17.5L17.5 4.5a2.1 2.1 0 0 1 3 3L7.5 20.5a2.1 2.1 0 0 1-3-3zM9 13l2 2M12 10l2 2M15 7l2 2" />,
  ],
  music: [
    <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    <><path d="M12 18V3.5c2 1.2 5.5 2.5 6 6" /><circle cx="9" cy="18" r="3" /></>,
    <path d="M4 16v-3a8 8 0 0 1 16 0v3M4 15h3v6H5a1 1 0 0 1-1-1zM20 15h-3v6h2a1 1 0 0 0 1-1z" />,
    <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7.5 13v7M12 13v7M16.5 13v7" /><path d="M6 4h3v9H6zM10.5 4h3v9h-3zM15 4h3v9h-3z" fill="currentColor" stroke="none" /></>,
  ],
  'english-language': [
    <path d="M4 20l4.5-1L19.5 8 16 4.5 5 15.5zM13.5 7l3.5 3.5" />,
    <path d="M4 11.5h4.5V18H4v-5c0-3.5 1.5-5.5 4.5-6.5M14 11.5h4.5V18H14v-5c0-3.5 1.5-5.5 4.5-6.5" />,
    <path d="M4 6h16M4 10h16M4 14h10M4 18h13" />,
    <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></>,
  ],
  'english-literature': [
    <path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z" />,
    <path d="M20 3c-7.5.5-12.5 6-13.5 15h4.5C16 16 18.5 10 20 3zM4 21l3-3.5M9.5 12.5l3-3" />,
    <path d="M3 18.5h18M4 18.5L3 7l5 4.5 4-6.5 4 6.5 5-4.5-1 11.5" />,
    <path d="M12 2l2 3v10h-4V5zM7.5 15h9M12 15v6" />,
  ],
}

/** How many pictures a subject has to choose from. */
export function subjectIconCount(subjectId: string): number {
  return SUBJECT_ICONS[subjectId]?.length ?? 1
}

/** One of a subject's pictures; `variant` wraps round, so any whole number is safe. */
export function SubjectIcon({ subjectId, variant = 0, ...props }: { subjectId: string; variant?: number } & SVGProps<SVGSVGElement>) {
  const options = SUBJECT_ICONS[subjectId]
  if (!options?.length) return <BookIcon {...props} />
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {options[((variant % options.length) + options.length) % options.length]}
    </svg>
  )
}
