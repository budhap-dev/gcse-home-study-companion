/**
 * The app mark: a roof over an open book, with a spark. Colours are fixed so
 * the mark looks the same in every theme. Keep in step with public/favicon.svg.
 */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3556c8" />
          <stop offset="1" stopColor="#1f3a93" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-g)" />
      <path d="M13 31 L32 14 L51 31" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 34 C22 31 27 32 31 35.5 V51 C27 47.5 22 46.5 17 48.5 Z" fill="#fff" />
      <path d="M47 34 C42 31 37 32 33 35.5 V51 C37 47.5 42 46.5 47 48.5 Z" fill="#fff" />
      <path d="M52 8 L53.6 12.4 L58 14 L53.6 15.6 L52 20 L50.4 15.6 L46 14 L50.4 12.4 Z" fill="#ffd166" />
    </svg>
  )
}

/**
 * Mark plus wordmark. `inline` sets the name on one line for the app header, where the
 * two-line version would be too tall.
 */
export function Logo({ inline = false, size = 36 }: { inline?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {inline ? (
        <span className="font-display text-base font-bold leading-none">Home Study Companion</span>
      ) : (
        <span className="font-display text-lg font-bold leading-tight">
          Home Study
          <br />
          Companion
        </span>
      )}
    </span>
  )
}
