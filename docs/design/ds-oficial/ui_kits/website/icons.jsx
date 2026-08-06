// icons.jsx — Lucide-style SVG icon set used across the website.
// Monoline, 2px stroke, round caps/joins, inherits currentColor.

const _icnProps = {
  width: 18, height: 18, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round',
};

const Icon = {
  MapPin: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Bed: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" /><path d="M6 8v9" />
    </svg>
  ),
  Bath: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h2" />
      <line x1="10" x2="8" y1="5" y2="7" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <line x1="7" x2="7" y1="19" y2="21" />
      <line x1="17" x2="17" y1="19" y2="21" />
    </svg>
  ),
  Area: (p) => (
    <svg {..._icnProps} {...p}>
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  ),
  Car: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
    </svg>
  ),
  Heart: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  ),
  HeartFill: (p) => (
    <svg {..._icnProps} {...p} fill="currentColor">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  ),
  Camera: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
  ArrowRight: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  ),
  Search: (p) => (
    <svg {..._icnProps} {...p}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Check: (p) => (
    <svg {..._icnProps} {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Close: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
  Phone: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  ),
  Tree: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M12 22v-7" />
      <path d="M9 8a3 3 0 1 1 6 0c1.1 0 3 .9 3 3a3 3 0 0 1-1 5.8V18a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-1.2A3 3 0 0 1 6 11c0-2.1 1.9-3 3-3Z" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg {..._icnProps} {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  ),
};

window.Icon = Icon;
