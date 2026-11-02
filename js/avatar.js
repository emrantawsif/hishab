// Characters for the crew: little portraits built from parts (skin, hair,
// eyes, brows, beard, glasses, hat, outfit, extras, mood) and drawn as inline
// SVG on a 100×100 grid.

// Every person writes in their own fountain-pen ink; it's also their shirt.
export const INKS = ['#1d3a8a', '#a3191f', '#1c6a45', '#5a2d82', '#7a4a12', '#0e5b66', '#8a1f5c', '#2a2a2a'];
// Softer versions of each ink, for fabric like a hijab.
const INK_FABRIC = ['#4c66ad', '#c0494e', '#3f8a64', '#7f58a8', '#a0743f', '#3a8693', '#ad4a83', '#5b5753'];
export const SKINS = ['#f7dcc0', '#ecc19a', '#d39a6c', '#a86f45', '#73472b'];
const SKIN_SHADES = ['#e5c09f', '#d7a67c', '#b88054', '#8d5935', '#5a3520'];
export const HAIR_COLORS = ['#1b1512', '#3a2417', '#6b4426', '#b07a40', '#9c9c9c'];

export const PARTS = {
  hair: ['short', 'side', 'quiff', 'curly', 'wavy', 'spiky', 'bun', 'ponytail', 'long', 'buzz', 'bald'],
  eyes: ['dots', 'round', 'happy', 'wink'],
  brows: ['soft', 'thick', 'arched', 'straight'],
  beard: ['none', 'stubble', 'mustache', 'goatee', 'full'],
  glasses: ['none', 'round', 'square', 'shades'],
  hat: ['none', 'cap', 'beanie', 'topi', 'chef', 'hijab', 'headband', 'crown'],
  outfit: ['tee', 'collar', 'panjabi', 'hoodie', 'jacket'],
  extra: ['none', 'earring', 'headphones', 'pen', 'blush'],
  mood: ['smile', 'grin', 'calm'],
};
export const COLOR_PARTS = { skin: SKINS, hairColor: HAIR_COLORS, ink: INKS };

const DEFAULT = {
  skin: 2, hair: 'short', hairColor: 0, eyes: 'dots', brows: 'soft', beard: 'none',
  glasses: 'none', hat: 'none', outfit: 'tee', extra: 'none', mood: 'smile', ink: 0,
};

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
    hair: pick(['short', 'side', 'quiff', 'curly', 'buzz', 'wavy', 'spiky', 'short', 'side']),
    hairColor: pick([0, 0, 0, 1, 1, 2]),
    eyes: pick(['dots', 'dots', 'round', 'happy']),
    brows: pick(['soft', 'soft', 'thick', 'arched', 'straight']),
    beard: pick(['none', 'stubble', 'full', 'goatee', 'mustache', 'none', 'full']),
    glasses: pick(['none', 'none', 'none', 'round', 'square']),
    hat: pick(['none', 'none', 'none', 'none', 'none', 'cap', 'beanie']),
    outfit: pick(['tee', 'tee', 'collar', 'panjabi', 'hoodie', 'jacket']),
    extra: pick(['none', 'none', 'none', 'none', 'earring', 'pen', 'headphones']),
    mood: pick(['smile', 'grin', 'calm', 'smile']),
    ink: Math.floor(next() * INKS.length),
  };
}

export function shuffleAvatar() {
  return avatarFromSeed(Math.random().toString(36));
}

// Avatars arrive in share links, so only known parts get through. Parts that
// older characters don't have yet get their defaults.
export function sanitizeAvatar(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const index = (value, list, key) => (Number.isInteger(value) && value >= 0 && value < list.length ? value : DEFAULT[key]);
  const part = key => (PARTS[key].includes(raw[key]) ? raw[key] : DEFAULT[key]);
  return {
    skin: index(raw.skin, SKINS, 'skin'),
    hair: part('hair'),
    hairColor: index(raw.hairColor, HAIR_COLORS, 'hairColor'),
    eyes: part('eyes'),
    brows: part('brows'),
    beard: part('beard'),
    glasses: part('glasses'),
    hat: part('hat'),
    outfit: part('outfit'),
    extra: part('extra'),
    mood: part('mood'),
    ink: index(raw.ink, INKS, 'ink'),
  };
}

const HAIR_TOP = {
  short: 'M30.5 44C29 27 38 20.5 50 20.5S71 27 69.5 44C67.5 36 61 31.5 50 31.5S32.5 36 30.5 44Z',
  side: 'M30.5 45C28.5 26 39 19.5 51 20S72 28 69.5 44C66 34 58 30 48 32.5 41 34 34.5 38.5 30.5 45Z',
  quiff: 'M30.5 44C29.5 30 33 21 42 17 50 13.5 61 15 66 21 70 26 70 35 69.5 44 67 36 61 32 51 32 40 32 33 36 30.5 44Z',
  buzz: 'M31 42C30.5 28 39 22 50 22S69.5 28 69 42C66.5 35 60 32 50 32S33.5 35 31 42Z',
  long: 'M30.5 46C29 27 38 20 50 20S71 27 69.5 46C67 36 60 30 50 30S33 36 30.5 46Z',
  wavy: 'M30.5 45C29 26 39 19 50 19S71 26 69.5 45C68 40 65 37 62 37 60 33 56 33 54 35 51 31 47 31 45 35 42 33 38 34 37 37 34 38 32 41 30.5 45Z',
  spiky: 'M31 42L30 28 36 31 37 20 43 26 47 16 51 25 56 17 59 26 64 21 64 31 70 29 69 42C66 35 60 32 50 32S34 35 31 42Z',
};
const BACK_HAIR = {
  long: 'M29 44C27 26 38 18 50 18S73 26 71 44L72.5 71C66 75 60 72.5 58.5 66H41.5C40 72.5 34 75 27.5 71Z',
  ponytail: 'M60 29C73 31 78 44 74.5 59 73 65 68.5 69 64 67 67.5 58 67.5 45 60 37Z',
};
const CURLS = [[33, 38, 6], [36, 30, 6.5], [42, 24.5, 7], [50, 22.5, 7.5], [58, 24.5, 7], [64, 30, 6.5], [67, 38, 6]];

const BEARDS = {
  stubble: '<path d="M31.5 47C32 61 40 68.5 50 68.5S68 61 68.5 47C66 55 60 60 50 60.5 40 60 34 55 31.5 47Z" opacity=".3"/>',
  mustache: '<path d="M43.5 55.2C46 53 48.5 53.6 50 54.6 51.5 53.6 54 53 56.5 55.2 54 56.4 51.5 56 50 55.4 48.5 56 46 56.4 43.5 55.2Z"/>',
  goatee: '<path d="M43.5 55.2C46 53 48.5 53.6 50 54.6 51.5 53.6 54 53 56.5 55.2 54 56.4 51.5 56 50 55.4 48.5 56 46 56.4 43.5 55.2Z"/><path d="M45.5 61C46 66 48 68.5 50 68.5S54 66 54.5 61C52.5 62.5 47.5 62.5 45.5 61Z"/>',
  full: '<path d="M31 45C31 62 39 70.5 50 70.5S69 62 69 45C67 52 63 55 59 55.5 56 54 53 53.6 50 54.2 47 53.6 44 54 41 55.5 37 55 33 52 31 45Z"/>',
};

const EYES = {
  dots: '<circle cx="43" cy="46" r="2" fill="#1d1a17"/><circle cx="57" cy="46" r="2" fill="#1d1a17"/>',
  round: '<g><ellipse cx="43" cy="46" rx="3.3" ry="3" fill="#fff"/><ellipse cx="57" cy="46" rx="3.3" ry="3" fill="#fff"/>'
    + '<circle cx="43.4" cy="46.3" r="1.8" fill="#1d1a17"/><circle cx="57.4" cy="46.3" r="1.8" fill="#1d1a17"/>'
    + '<circle cx="44" cy="45.6" r=".6" fill="#fff"/><circle cx="58" cy="45.6" r=".6" fill="#fff"/></g>',
  happy: '<path d="M40.3 47Q43 43.8 45.7 47M54.3 47Q57 43.8 59.7 47" fill="none" stroke="#1d1a17" stroke-width="1.8" stroke-linecap="round"/>',
  wink: '<circle cx="43" cy="46" r="2" fill="#1d1a17"/><path d="M54.3 47Q57 43.8 59.7 47" fill="none" stroke="#1d1a17" stroke-width="1.8" stroke-linecap="round"/>',
};

const BROWS = {
  soft: ['M39.5 40.5Q43 38.5 46.5 40M53.5 40Q57 38.5 60.5 40.5', 2],
  thick: ['M39.5 40.5Q43 38.5 46.5 40M53.5 40Q57 38.5 60.5 40.5', 3.4],
  arched: ['M39.5 41Q43 36.8 46.5 39.6M53.5 39.6Q57 36.8 60.5 41', 2],
  straight: ['M39.5 39.6H46.5M53.5 39.6H60.5', 2.4],
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

const OUTFITS = {
  tee: () => '<path d="M41 73.5L50 83 59 73.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>',
  collar: () => '<path d="M41 72L50 80.5 44 85Z" fill="#fff"/><path d="M59 72L50 80.5 56 85Z" fill="#fff"/>'
    + '<circle cx="50" cy="87" r="1.1" fill="#fff" opacity=".85"/><circle cx="50" cy="93" r="1.1" fill="#fff" opacity=".85"/>',
  panjabi: () => '<path d="M41.5 71.5Q50 75.5 58.5 71.5L58.5 75Q50 79 41.5 75Z" fill="#000" fill-opacity=".2"/>'
    + '<path d="M50 77V98" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>'
    + '<circle cx="50" cy="81" r="1.2" fill="#f2d27a"/><circle cx="50" cy="86.5" r="1.2" fill="#f2d27a"/><circle cx="50" cy="92" r="1.2" fill="#f2d27a"/>',
  hoodie: () => '<path d="M33 77C37 70 44 69.5 50 73 56 69.5 63 70 67 77 61 80.5 56 81.5 50 81.5S39 80.5 33 77Z" fill="#000" fill-opacity=".2"/>'
    + '<path d="M46 80V89M54 80V89" stroke="#fff" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round"/>',
  jacket: () => '<path d="M42 72L50 91 58 72Z" fill="#f4f1ea"/>'
    + '<path d="M42 72L50 91 44 93 37 76Z" fill="#000" fill-opacity=".28"/><path d="M58 72L50 91 56 93 63 76Z" fill="#000" fill-opacity=".28"/>',
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
  if (hat === 'headband') {
    return `<path d="M30.6 37.5Q50 29.5 69.4 37.5L69.6 42Q50 34 30.4 42Z" fill="${ink}"/><path d="M30.5 39.6Q50 31.8 69.5 39.6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1"/>`;
  }
  if (hat === 'crown') {
    return '<path d="M37 25L39 11 45 18 50 8 55 18 61 11 63 25Z" fill="#e8b730" stroke="#b07d12" stroke-width="1" stroke-linejoin="round"/>'
      + '<rect x="37" y="22.5" width="26" height="3.5" rx="1" fill="#d9a520"/>'
      + '<circle cx="50" cy="16.5" r="1.7" fill="#c0262d"/><circle cx="42.5" cy="19.5" r="1.2" fill="#1c6a45"/><circle cx="57.5" cy="19.5" r="1.2" fill="#1d3a8a"/>';
  }
  return '';
}

export function avatarSvg(raw) {
  const a = sanitizeAvatar(raw) || DEFAULT;
  const skin = SKINS[a.skin];
  const shade = SKIN_SHADES[a.skin];
  const hair = HAIR_COLORS[a.hairColor];
  const ink = INKS[a.ink];
  const fabric = INK_FABRIC[a.ink];
  const hijab = a.hat === 'hijab';
  const out = [
    '<rect width="100" height="100" fill="#f5ecd8"/>',
    `<rect width="100" height="100" fill="${ink}" opacity=".16"/>`,
  ];
  if (!hijab && BACK_HAIR[a.hair]) out.push(`<path d="${BACK_HAIR[a.hair]}" fill="${hair}"/>`);
  out.push(
    `<path d="M8 104C10 80 28 72 50 72S90 80 92 104Z" fill="${ink}"/>`,
    `<path d="M42 58H58V70C58 74.5 42 74.5 42 70Z" fill="${shade}"/>`,
    OUTFITS[a.outfit](),
  );
  if (hijab) {
    out.push(`<path d="M26.5 48C25.5 24 37.5 14.5 50 14.5S74.5 24 73.5 48L76 76C70 82 30 82 24 76Z" fill="${fabric}"/>`);
  } else {
    out.push(`<ellipse cx="31" cy="47" rx="3.6" ry="5" fill="${shade}"/><ellipse cx="69" cy="47" rx="3.6" ry="5" fill="${shade}"/>`);
  }
  out.push(`<ellipse cx="50" cy="45" rx="19" ry="22" fill="${skin}"/>`);
  if (a.extra === 'blush') out.push('<ellipse cx="38.5" cy="52.5" rx="3.2" ry="1.8" fill="#ff6f6f" opacity=".35"/><ellipse cx="61.5" cy="52.5" rx="3.2" ry="1.8" fill="#ff6f6f" opacity=".35"/>');
  if (a.beard !== 'none') out.push(`<g fill="${hair}">${BEARDS[a.beard]}</g>`);
  const [browPath, browWidth] = BROWS[a.brows];
  out.push(
    EYES[a.eyes],
    `<path d="${browPath}" fill="none" stroke="${hair}" stroke-width="${browWidth}" stroke-linecap="round"/>`,
    `<path d="M50 47Q48.2 52.5 50.8 53" fill="none" stroke="${shade}" stroke-width="1.6" stroke-linecap="round"/>`,
    MOUTHS[a.mood](a.beard === 'full' ? '#efc9bb' : '#6b2a20'),
  );
  if (hijab) {
    out.push(`<path d="M30.8 44C30.5 27 39.5 21.5 50 21.5S69.5 27 69.2 44C66.5 33.5 59 29.8 50 29.8S33.5 33.5 30.8 44Z" fill="${fabric}"/>`,
      '<path d="M31 46C30 30 38 23 50 22.5" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.2"/>');
  } else if (a.hair === 'curly') {
    out.push(`<path d="${HAIR_TOP.short}" fill="${hair}"/>`, ...CURLS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${hair}"/>`));
  } else if (a.hair === 'bun') {
    out.push(`<circle cx="50" cy="17.5" r="7.5" fill="${hair}"/><path d="${HAIR_TOP.short}" fill="${hair}"/>`);
  } else if (a.hair === 'ponytail') {
    out.push(`<path d="${HAIR_TOP.side}" fill="${hair}"/>`);
  } else if (a.hair === 'bald') {
    out.push('<ellipse cx="43" cy="29" rx="6" ry="2.6" fill="#fff" opacity=".35"/>');
  } else {
    out.push(`<path d="${HAIR_TOP[a.hair]}" fill="${hair}" ${a.hair === 'buzz' ? 'fill-opacity=".55"' : ''}/>`);
  }
  if (a.glasses !== 'none') out.push(GLASSES[a.glasses]);
  if (a.extra === 'earring' && !hijab) out.push('<circle cx="30.6" cy="53" r="1.7" fill="#e3b341"/><circle cx="69.4" cy="53" r="1.7" fill="#e3b341"/>');
  if (a.extra === 'headphones') {
    out.push('<path d="M28.5 47C27.5 24 39 14.5 50 14.5S72.5 24 71.5 47" fill="none" stroke="#2b2b30" stroke-width="3.5"/>',
      `<rect x="25" y="41" width="7.5" height="12.5" rx="3.2" fill="#2b2b30"/><rect x="67.5" y="41" width="7.5" height="12.5" rx="3.2" fill="#2b2b30"/><rect x="26.5" y="43.5" width="2" height="7.5" rx="1" fill="${ink}"/><rect x="71.5" y="43.5" width="2" height="7.5" rx="1" fill="${ink}"/>`);
  }
  if (!hijab) out.push(hatSvg(a.hat, ink));
  if (a.extra === 'pen') {
    out.push('<g transform="rotate(-38 70 40)"><rect x="67" y="27" width="3.2" height="23" rx="1.3" fill="#1d3a8a"/><rect x="67" y="27" width="3.2" height="4" rx="1" fill="#c9a24a"/><path d="M67 50L68.6 55 70.2 50Z" fill="#c9a24a"/></g>');
  }
  return `<svg viewBox="7 8 86 86" aria-hidden="true" focusable="false">${out.join('')}</svg>`;
}
