import type { SVGProps } from 'react'

/**
 * Line icons for the good deeds and the themes of the thoughts, one per name in
 * packages/shared/src/character.ts. Drawn like the menu icons: a 24-unit box, a 2-unit
 * round stroke, no fill, so they take the card's colour and read at 40px or at 22px.
 */
const PATHS: Record<string, string> = {
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  broom: 'M15 3l-6 10M9 13l4 2.5-2 5.5-7-1.5zM8 17l1 2M11 16.5l.5 2.5',
  'bubble-heart': 'M4 5h16v11H9l-5 4zM12 13.5s-3-1.9-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.1-3 4-3 4z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  gift: 'M3 9h18v12H3zM12 9v12M3 14h18M12 9c-2 0-4.5-1-4.5-3a2 2 0 0 1 4-.5c.5 1 .5 2 .5 3.5zM12 9c2 0 4.5-1 4.5-3a2 2 0 0 0-4-.5c-.5 1-.5 2-.5 3.5z',
  bin: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  ear: 'M6.5 10a5.5 5.5 0 0 1 11 0c0 3-2 3.5-2.5 6a3 3 0 0 1-6 0M10 10a2 2 0 0 1 4 0c0 1.5-1.5 2-1.5 3.5',
  hand: 'M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-12 0v-3a1.5 1.5 0 0 1 3 0',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  box: 'M3 8l9-4 9 4-9 4zM3 8v9l9 4 9-4V8M12 12v9',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  'person-arrow': 'M8 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20a6 6 0 0 1 12 0M15 12h7M19 9l3 3-3 3',
  notebook: 'M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM9 3v18M12 8h4M12 12h4M12 16h3',
  'thumbs-up': 'M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-7a2 2 0 0 1 3 2l-.5 3H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 19H7',
  'bubble-x': 'M4 5h16v11H9l-5 4zM9.5 8l5 5M14.5 8l-5 5',
  lifebuoy: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6',
  hourglass: 'M6 3h12M6 21h12M8 3c0 4 2 6 4 9s4 5 4 9M16 3c0 4-2 6-4 9s-4 5-4 9',
  badge: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9 5V3h6v2M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 17a4 4 0 0 1 8 0',
  return: 'M9 10L4 14l5 4M4 14h11a5 5 0 0 0 0-10h-3',
  'person-plus': 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M18 8v6M15 11h6',
  bubbles: 'M3 4h11v8H8l-4 3zM14 9h7v8h-2l-3 3v-3h-2v-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  cap: 'M2 9l10-4 10 4-10 4zM6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4M22 9v5',
  cookie: 'M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3.5-3A3 3 0 0 1 14 5.5 3 3 0 0 1 12 3zM8.5 10h.01M9.5 15h.01M14 15.5h.01M12 11.5h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  envelope: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  flame: 'M12 21a6 6 0 0 1-6-6c0-3 2-5 3-7 .5 1.5 1.5 2.5 2.5 3C12 8 12 5 14 3c2 3 4 6 4 10a6 6 0 0 1-6 8z',
  mountain: 'M3 20l6-11 3 5 2-3 7 9zM9 9l1.5 2.5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  sprout: 'M12 21v-7M12 14c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  scales: 'M12 3v18M5 21h14M12 6l-6 2M12 6l6 2M3 14a3 3 0 0 0 6 0L6 8zM15 14a3 3 0 0 0 6 0l-3-6z',
  'book-open': 'M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2zM12 6v14',
}

export const CHARACTER_ICON_NAMES = Object.keys(PATHS)

/** One of the character icons by name. An unknown name draws a plain circle rather than nothing. */
export function CharacterIcon({ name, size = 24, ...props }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  const d = PATHS[name] ?? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden data-icon={name} {...props}>
      <path d={d} />
    </svg>
  )
}
