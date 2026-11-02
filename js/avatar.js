// Characters for the crew: little portraits built from parts (skin, hair,
// beard, glasses, hat, mood) and drawn as inline SVG on a 100×100 grid.

// Every person writes in their own fountain-pen ink; it's also their shirt.
export const INKS = ['#1d3a8a', '#a3191f', '#1c6a45', '#5a2d82', '#7a4a12', '#0e5b66', '#8a1f5c', '#2a2a2a'];
export const SKINS = ['#f7dcc0', '#ecc19a', '#d39a6c', '#a86f45', '#73472b'];
const SKIN_SHADES = ['#e5c09f', '#d7a67c', '#b88054', '#8d5935', '#5a3520'];
export const HAIR_COLORS = ['#1b1512', '#3a2417', '#6b4426', '#b07a40', '#9c9c9c'];

export const PARTS = {
  hair: ['short', 'side', 'quiff', 'curly', 'long', 'buzz', 'bald'],
  beard: ['none', 'stubble', 'mustache', 'goatee', 'full'],
  glasses: ['none', 'round', 'square', 'shades'],
  hat: ['none', 'cap', 'beanie', 'topi', 'chef'],
  mood: ['smile', 'grin', 'calm'],
};
export const COLOR_PARTS = { skin: SKINS, hairColor: HAIR_COLORS, ink: INKS };

const DEFAULT = { skin: 2, hair: 'short', hairColor: 0, beard: 'none', glasses: 'none', hat: 'none', mood: 'smile', ink: 0 };

// Same seed, same character, on every phone.
export function avatarFromSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  const next = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const pick = list => list[Math.floor(next() * list.length)];
  return {
    skin: pick([1, 2, 2, 3, 3, 4]),
    hair: pick(['short', 'side', 'quiff', 'curly', 'buzz', 'short', 'side']),
    hairColor: pick([0, 0, 0, 1, 1, 2]),
    beard: pick(['none', 'stubble', 'full', 'goatee', 'mustache', 'none', 'full']),
    glasses: pick(['none', 'none', 'none', 'round', 'square']),
    hat: pick(['none', 'none', 'none', 'none', 'none', 'cap', 'beanie']),
    mood: pick(['smile', 'grin', 'calm', 'smile']),
    ink: Math.floor(next() * INKS.length),
  };
}

export function shuffleAvatar() {
  return avatarFromSeed(Math.random().toString(36));
}

// Avatars arrive in share links, so only known parts get through.
export function sanitizeAvatar(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const index = (value, list) => (Number.isInteger(value) && value >= 0 && value < list.length ? value : null);
  const part = (value, key) => (PARTS[key].includes(value) ? value : DEFAULT[key]);
  return {
    skin: index(raw.skin, SKINS) ?? DEFAULT.skin,
    hair: part(raw.hair, 'hair'),
    hairColor: index(raw.hairColor, HAIR_COLORS) ?? DEFAULT.hairColor,
    beard: part(raw.beard, 'beard'),
    glasses: part(raw.glasses, 'glasses'),
    hat: part(raw.hat, 'hat'),
    mood: part(raw.mood, 'mood'),
    ink: index(raw.ink, INKS) ?? DEFAULT.ink,
  };
}

const HAIR_TOP = {
  short: 'M30.5 44C29 27 38 20.5 50 20.5S71 27 69.5 44C67.5 36 61 31.5 50 31.5S32.5 36 30.5 44Z',
  side: 'M30.5 45C28.5 26 39 19.5 51 20S72 28 69.5 44C66 34 58 30 48 32.5 41 34 34.5 38.5 30.5 45Z',
  quiff: 'M30.5 44C29.5 30 33 21 42 17 50 13.5 61 15 66 21 70 26 70 35 69.5 44 67 36 61 32 51 32 40 32 33 36 30.5 44Z',
  buzz: 'M31 42C30.5 28 39 22 50 22S69.5 28 69 42C66.5 35 60 32 50 32S33.5 35 31 42Z',
  long: 'M30.5 46C29 27 38 20 50 20S71 27 69.5 46C67 36 60 30 50 30S33 36 30.5 46Z',
};
const CURLS = [[33, 38, 6], [36, 30, 6.5], [42, 24.5, 7], [50, 22.5, 7.5], [58, 24.5, 7], [64, 30, 6.5], [67, 38, 6]];

const BEARDS = {
  stubble: '<path d="M31.5 47C32 61 40 68.5 50 68.5S68 61 68.5 47C66 55 60 60 50 60.5 40 60 34 55 31.5 47Z" opacity=".3"/>',
  mustache: '<path d="M43.5 55.2C46 53 48.5 53.6 50 54.6 51.5 53.6 54 53 56.5 55.2 54 56.4 51.5 56 50 55.4 48.5 56 46 56.4 43.5 55.2Z"/>',
  goatee: '<path d="M43.5 55.2C46 53 48.5 53.6 50 54.6 51.5 53.6 54 53 56.5 55.2 54 56.4 51.5 56 50 55.4 48.5 56 46 56.4 43.5 55.2Z"/><path d="M45.5 61C46 66 48 68.5 50 68.5S54 66 54.5 61C52.5 62.5 47.5 62.5 45.5 61Z"/>',
  full: '<path d="M31 45C31 62 39 70.5 50 70.5S69 62 69 45C67 52 63 55 59 55.5 56 54 53 53.6 50 54.2 47 53.6 44 54 41 55.5 37 55 33 52 31 45Z"/>',
};

const MOUTHS = {
  smile: color => `<path d="M44.5 57.5Q50 61.5 55.5 57.5" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`,
  grin: () => '<path d="M44 56.5Q50 64 56 56.5Z" fill="#5a1f17"/><path d="M45 57.1Q50 58.6 55 57.1L54.4 58.4Q50 59.8 45.6 58.4Z" fill="#fff"/>',
  calm: color => `<path d="M46 58.2H54" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`,
};

const GLASSES = {
  round: '<g fill="#fff" fill-opacity=".18" stroke="#1f1f22" stroke-width="1.7"><circle cx="43" cy="46" r="5.2"/><circle cx="57" cy="46" r="5.2"/><path d="M48.2 46Q50 44.8 51.8 46" fill="none"/></g>',
  square: '<g fill="#fff" fill-opacity=".18" stroke="#1f1f22" stroke-width="1.7"><rect x="37.3" y="41.6" width="11.2" height="8.6" rx="2"/><rect x="51.5" y="41.6" width="11.2" height="8.6" rx="2"/><path d="M48.5 45.5H51.5" fill="none"/></g>',
  shades: '<g stroke="#111" stroke-width="1.5"><rect x="37" y="41.8" width="11.6" height="8" rx="3" fill="#1d1d22"/><rect x="51.4" y="41.8" width="11.6" height="8" rx="3" fill="#1d1d22"/><path d="M48.6 45H51.4" fill="none"/></g><path d="M39.5 44H43M54 44H57.5" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>',
};

function hatSvg(hat, ink) {
  if (hat === 'cap') {
    return `<path d="M29.5 38C29.5 24 38.5 16.5 50 16.5S70.5 24 70.5 38Z" fill="${ink}"/><path d="M29.5 38C29.5 24 38.5 16.5 50 16.5" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/>`
      + `<path d="M47 35C58 32 72 32.5 80 37.5 70 39.5 58 39 47 38Z" fill="${ink}"/><path d="M47 38C58 39 70 39.5 80 37.5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/><circle cx="50" cy="17" r="1.8" fill="#000" fill-opacity=".3"/>`;
  }
  if (hat === 'beanie') {
    return `<path d="M29.5 40C29.5 24 38.5 15.5 50 15.5S70.5 24 70.5 40Z" fill="${ink}"/><rect x="28.5" y="33.5" width="43" height="8" rx="3.5" fill="${ink}"/><rect x="28.5" y="33.5" width="43" height="8" rx="3.5" fill="#000" fill-opacity=".22"/>`
      + '<path d="M36 34V41.5M42 34V41.5M48 34V41.5M54 34V41.5M60 34V41.5M66 34V41.5" stroke="#fff" stroke-opacity=".2" stroke-width="1.2"/>'
      + `<circle cx="50" cy="14.5" r="4.5" fill="${ink}"/><circle cx="50" cy="14.5" r="4.5" fill="#fff" fill-opacity=".25"/>`;
  }
  if (hat === 'topi') {
    return '<path d="M31.5 34C32.5 25.5 40.5 21 50 21S67.5 25.5 68.5 34C62 32 56 31.3 50 31.3S38 32 31.5 34Z" fill="#f4f1ea" stroke="#cfc8b8" stroke-width="1"/>'
      + '<path d="M36 30.5Q50 27 64 30.5" fill="none" stroke="#cfc8b8" stroke-width="1" stroke-dasharray="1.5 2"/>';
  }
  if (hat === 'chef') {
    return '<g fill="#fff" stroke="#d9d4ca" stroke-width="1"><circle cx="39.5" cy="19" r="8.5"/><circle cx="60.5" cy="19" r="8.5"/><circle cx="50" cy="14" r="10"/><rect x="34.5" y="20" width="31" height="13" rx="2"/></g>'
      + '<path d="M35.5 21.5H64.5" stroke="#fff" stroke-width="3"/>';
  }
  return '';
}

export function avatarSvg(raw) {
  const a = sanitizeAvatar(raw) || DEFAULT;
  const skin = SKINS[a.skin];
  const shade = SKIN_SHADES[a.skin];
  const hair = HAIR_COLORS[a.hairColor];
  const ink = INKS[a.ink];
  const out = [
    '<rect width="100" height="100" fill="#f5ecd8"/>',
    `<rect width="100" height="100" fill="${ink}" opacity=".16"/>`,
  ];
  if (a.hair === 'long') out.push(`<path d="M29 44C27 26 38 18 50 18S73 26 71 44L72.5 71C66 75 60 72.5 58.5 66H41.5C40 72.5 34 75 27.5 71Z" fill="${hair}"/>`);
  out.push(
    `<path d="M8 104C10 80 28 72 50 72S90 80 92 104Z" fill="${ink}"/>`,
    '<path d="M41 73.5L50 83 59 73.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>',
    `<path d="M42 58H58V70C58 74.5 42 74.5 42 70Z" fill="${shade}"/>`,
    `<ellipse cx="31" cy="47" rx="3.6" ry="5" fill="${shade}"/><ellipse cx="69" cy="47" rx="3.6" ry="5" fill="${shade}"/>`,
    `<ellipse cx="50" cy="45" rx="19" ry="22" fill="${skin}"/>`,
  );
  if (a.beard !== 'none') out.push(`<g fill="${hair}">${BEARDS[a.beard]}</g>`);
  out.push(
    '<circle cx="43" cy="46" r="2" fill="#1d1a17"/><circle cx="57" cy="46" r="2" fill="#1d1a17"/>',
    `<path d="M39.5 40.5Q43 38.5 46.5 40M53.5 40Q57 38.5 60.5 40.5" fill="none" stroke="${hair}" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M50 47Q48.2 52.5 50.8 53" fill="none" stroke="${shade}" stroke-width="1.6" stroke-linecap="round"/>`,
    MOUTHS[a.mood](a.beard === 'full' ? '#efc9bb' : '#6b2a20'),
  );
  if (a.hair === 'curly') {
    out.push(`<path d="${HAIR_TOP.short}" fill="${hair}"/>`, ...CURLS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${hair}"/>`));
  } else if (a.hair === 'bald') {
    out.push('<ellipse cx="43" cy="29" rx="6" ry="2.6" fill="#fff" opacity=".35"/>');
  } else {
    out.push(`<path d="${HAIR_TOP[a.hair]}" fill="${hair}" ${a.hair === 'buzz' ? 'fill-opacity=".55"' : ''}/>`);
  }
  if (a.glasses !== 'none') out.push(GLASSES[a.glasses]);
  out.push(hatSvg(a.hat, ink));
  return `<svg viewBox="7 8 86 86" aria-hidden="true" focusable="false">${out.join('')}</svg>`;
}
