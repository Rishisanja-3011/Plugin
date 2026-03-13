const normalizeGlyph = (glyph) => String(glyph ?? '').replace(/\uFE0F/g, '').trim();

const GLYPH_TO_NAME = {
  ['\u{1F4CA}']: 'dashboard',
  ['\u{1F4C8}']: 'analytics',
  ['\u{1F3E2}']: 'station',
  ['\u{1F50C}']: 'plug',
  ['\u{1F4B2}']: 'pricing',
  ['\u{1F4CB}']: 'bookings',
  ['\u{1F465}']: 'customers',
  ['\u26A1']: 'sessions',
  ['\u{1F4B0}']: 'revenue',
  ['\u{1F4B8}']: 'revenue',
  ['\u{1F50B}']: 'energy',
  ['\u{1F4DD}']: 'audit',
  ['\u{1F514}']: 'notifications',
  ['\u{1F4CD}']: 'location',
  ['\u{1F550}']: 'time',
  ['\u{1F4DE}']: 'phone',
  ['\u{1F310}']: 'web',
  ['\u26A0']: 'warning',
  ['\u{1F4E7}']: 'mail',
  ['\u{1F4ED}']: 'mail-open',
  ['\u23F3']: 'loading',
  ['\u{1F4B3}']: 'card',
  ['\u{1F4C5}']: 'calendar',
  ['\u2139']: 'info',
  ['\u2713']: 'success',
  ['\u2715']: 'error',
};

const DIRECT_NAMES = new Set([
  'dashboard',
  'analytics',
  'station',
  'plug',
  'pricing',
  'bookings',
  'customers',
  'sessions',
  'revenue',
  'energy',
  'audit',
  'notifications',
  'location',
  'time',
  'phone',
  'web',
  'warning',
  'mail',
  'mail-open',
  'loading',
  'card',
  'calendar',
  'info',
  'success',
  'error',
  'dot',
]);

function glyphName(glyph) {
  const normalized = normalizeGlyph(glyph);
  if (DIRECT_NAMES.has(normalized)) return normalized;
  return GLYPH_TO_NAME[normalized] ?? 'dot';
}

function IconSvg({ name, className }) {
  const common = { className, viewBox: '0 0 24 24', 'aria-hidden': 'true' };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M5 19.5h14M7.2 17V11M12 17V7M16.8 17v-4.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M4.5 19.5h15M7 16l3.8-4.1 2.8 2.2 3.9-4.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="16" r="1" fill="currentColor" />
          <circle cx="10.8" cy="11.9" r="1" fill="currentColor" />
          <circle cx="13.6" cy="14.1" r="1" fill="currentColor" />
          <circle cx="17.5" cy="9.5" r="1" fill="currentColor" />
        </svg>
      );
    case 'station':
      return (
        <svg {...common}>
          <path d="M4.5 20h15M6.6 20V8.2h10.8V20M9 11h1.8M13.2 11H15M9 14.2h1.8M13.2 14.2H15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'plug':
      return (
        <svg {...common}>
          <path d="M9 3.2v4.2M15 3.2v4.2M7.4 7.4h9.2v1.7a4.6 4.6 0 0 1-4.6 4.6h0a4.6 4.6 0 0 1-4.6-4.6V7.4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 13.7V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'pricing':
      return (
        <svg {...common}>
          <path d="M5 8.8 9.4 4.5h8.1l2 2v8.1L15 19H6.8l-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 8v8M14.8 10.2c0-1.2-1.1-2-2.8-2s-2.8.8-2.8 2 1.1 2 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2-2.8-.8-2.8-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'bookings':
      return (
        <svg {...common}>
          <rect x="4.4" y="3.8" width="15.2" height="16.4" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 3.2v3.4M15.8 3.2v3.4M4.4 8.7h15.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...common}>
          <circle cx="9" cy="8.2" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15.6" cy="9.2" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.8 18.8c0-2.6 2.1-4.6 4.7-4.6s4.7 2 4.7 4.6M13.2 18.8c.2-2 1.9-3.6 4-3.6 1.1 0 2 .3 2.8 1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'sessions':
      return (
        <svg {...common}>
          <path fill="currentColor" d="M13 2 5 13.2h5.3L9.2 22 19 10.5h-5.3z" />
        </svg>
      );
    case 'revenue':
      return (
        <svg {...common}>
          <rect x="3.5" y="6.5" width="17" height="11.8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.8" cy="14.4" r="1" fill="currentColor" />
        </svg>
      );
    case 'energy':
      return (
        <svg {...common}>
          <rect x="4.5" y="6.8" width="14.5" height="10.4" rx="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="19.1" y="10" width="1.9" height="4" rx="0.8" fill="currentColor" />
          <rect x="6.5" y="8.8" width="5.2" height="6.4" rx="0.8" fill="currentColor" />
        </svg>
      );
    case 'audit':
      return (
        <svg {...common}>
          <path d="M7 3.8h8l3 3V20.2H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M15 3.8v3h3M9.8 11.2h5.4M9.8 14.2h5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'notifications':
      return (
        <svg {...common}>
          <path d="M8 10.3a4 4 0 0 1 8 0V14l1.7 2.2v1H6.3v-1L8 14z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 18.2a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'location':
      return (
        <svg {...common}>
          <path d="M12 20s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="10.2" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'time':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7.8v4.5l3.1 2.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <path d="M7.4 4.2h3l1.2 3.1-1.8 1.5a11.6 11.6 0 0 0 5.4 5.4l1.5-1.8 3.1 1.2v3a1.4 1.4 0 0 1-1.5 1.4A15.8 15.8 0 0 1 5.9 5.7 1.4 1.4 0 0 1 7.4 4.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case 'web':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 12h16M12 4a13.3 13.3 0 0 1 0 16M12 4a13.3 13.3 0 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 4.2 20 19H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 9v4.7M12 16.5h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3.8" y="6.2" width="16.4" height="11.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m4.6 7.2 7.4 5.4 7.4-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case 'mail-open':
      return (
        <svg {...common}>
          <path d="m3.8 10 8.2-5.2L20.2 10v7.6H3.8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m3.8 10 8.2 5.2 8.2-5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case 'loading':
      return (
        <svg {...common}>
          <path d="M7.5 3.8v4.3h9V3.8M7.5 20.2v-4.3h9v4.3M9.2 8.1v7.8m5.6-7.8v7.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="3.5" y="6.5" width="17" height="11" rx="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 10.2h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="6.2" y="13" width="5.5" height="2.1" rx="0.6" fill="currentColor" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="4.4" y="4.3" width="15.2" height="15.3" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 3.2v3M15.8 3.2v3M4.4 9h15.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 10.4v5M12 7.8h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'success':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8.5 12.2 2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m9.2 9.2 5.6 5.6m0-5.6-5.6 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        </svg>
      );
  }
}

export default function IconGlyph({ glyph, className = 'mono-icon mono-icon--md' }) {
  return <IconSvg name={glyphName(glyph)} className={className} />;
}
