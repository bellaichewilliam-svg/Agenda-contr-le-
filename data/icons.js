// כדאי v34 — SVG icon library (Lucide-style, stroke-2, currentColor)
// Replaces OS emoji icons on action buttons. Emojis stay for decorative
// product illustrations only (hero, promo tiles, deal cards, achievements).
//
// Usage in JS templates: ${icon("search", 20)}
// Usage in HTML: inline the <svg> directly.

const ICONS = {
  // Navigation & UI primitives
  search:        'M11 17a6 6 0 1 1 4.24-1.76L21 21M11 5a6 6 0 0 1 6 6',
  x:             'M18 6 6 18M6 6l12 12',
  check:         'M5 12l5 5L20 7',
  plus:          'M12 5v14M5 12h14',
  minus:         'M5 12h14',
  "arrow-right": 'M5 12h14M13 5l7 7-7 7',
  "arrow-left":  'M19 12H5M11 19l-7-7 7-7',
  send:          'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  "chevron-right":'m9 6 6 6-6 6',
  "chevron-down":'m6 9 6 6 6-6',
  trash:         'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  share:         'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',

  // Heart (outline + filled)
  heart:         'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z',

  // Header actions
  bell:          'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  user:          'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',

  // Section / view icons
  "shopping-bag":'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0',
  newspaper:     'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V11h4M18 14h-8M15 18h-5M10 6h8v4h-8z',
  store:         'M3 9 4 4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1l1 5M3 9v11a1 1 0 0 0 1 1h4v-7h8v7h4a1 1 0 0 0 1-1V9M3 9h18M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
  "map-pin":     'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  home:          'M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM9 22V12h6v10',
  gift:          'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H8a2.5 2.5 0 0 1 0-5C12 2 12 7 12 7M12 7h4a2.5 2.5 0 0 0 0-5C12 2 12 7 12 7',
  list:          'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  "more-horizontal":'M19 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  "message-circle":'M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-7.6-4.7L3 21l1.9-5.6A8.5 8.5 0 0 1 12.5 3a8.38 8.38 0 0 1 8.5 8.5Z',

  // Tools (4th-tab grid)
  "trending-up":  'm22 7-8.5 8.5-5-5L2 17M16 7h6v6',
  "trending-down":'m22 17-8.5-8.5-5 5L2 7M16 17h6v-6',
  "chef-hat":    'M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z',
  calendar:      'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM16 2v4M8 2v4M3 10h18',
  trophy:        'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0Z',
  users:         'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',

  // Settings
  moon:          'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z',
  sun:           'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  bell2:         'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',

  // Legal (4th-tab list)
  smartphone:    'M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM12 18h.01',
  "file-text":   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M16 13H8M16 17H8M10 9H8',
  lock:          'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  mail:          'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM22 6 12 13 2 6',

  // Hero / promo decor (functional, not illustrative)
  flame:         'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  zap:           'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  "badge-check": 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76ZM9 12l2 2 4-4',
  truck:         'M16 16V4H1v12h2M16 16h6V8h-4l-2 8ZM5.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',

  // Premium
  crown:         'm2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 16h14',

  // Star (achievements / ratings)
  star:          'M12 2l2.7 6.5L22 9.3l-5.5 4.8L18 21l-6-3.5L6 21l1.5-6.9L2 9.3l7.3-.8L12 2Z',

  // FAB Chat
  "message-bot": 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 8v0M8 12c1 1 3 1 4 0M16 12c-1 1-3 1-4 0',

  // Settings/cog (for future use)
  settings:      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
};

const ICON_FILLS = {
  "heart-filled": true,
};

/**
 * Returns an inline SVG string for a Lucide-style icon.
 * @param {string} name
 * @param {number} size — pixel width/height (default 20)
 * @param {string} extraClass — optional class to add
 */
function icon(name, size = 20, extraClass = "") {
  const isFilled = ICON_FILLS[name];
  const realName = isFilled ? name.replace("-filled", "") : name;
  const path = ICONS[realName];
  if (!path) return `<span class="icon icon-missing" aria-hidden="true">?</span>`;
  const fill = isFilled ? "currentColor" : "none";
  const cls = `icon icon-${name}${extraClass ? " " + extraClass : ""}`;
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
    `fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`
  );
}

window.kedaiIcon = icon;
window.kedaiIcons = ICONS;
