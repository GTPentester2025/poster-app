// Curated creative library: professional palettes + font pairings the
// creative-director agent chooses FROM (constrained choice — never free-form
// hex). Every palette carries the same keys templates already consume
// (primary/secondary/accent/background/dark) so a pick drops straight into
// template builds; `dark` is always deep enough that pickTextColor() yields
// readable text on `background`. Mood/tone tags drive both the model prompt
// and the deterministic fallback (intent → mood map in creative_director).

export const PALETTES = [
  {
    id: 'brand-gold', name: 'Brand Gold', moods: ['professional', 'warm', 'corporate'],
    primary: '#E3AF32', secondary: '#000000', accent: '#C8102E', background: '#F5F0E8', dark: '#1F1A17'
  },
  {
    id: 'midnight-cyan', name: 'Midnight Cyan', moods: ['futuristic', 'dark', 'tech'],
    primary: '#22D3EE', secondary: '#0EA5E9', accent: '#F59E0B', background: '#0B1220', dark: '#04070D'
  },
  {
    id: 'deep-violet', name: 'Deep Violet', moods: ['futuristic', 'cinematic', 'premium'],
    primary: '#8B5CF6', secondary: '#6D28D9', accent: '#F472B6', background: '#120B1E', dark: '#080312'
  },
  {
    id: 'signal-red', name: 'Signal Red', moods: ['energy', 'urgent', 'alert'],
    primary: '#DC2626', secondary: '#7F1D1D', accent: '#FACC15', background: '#FFF7ED', dark: '#1C1210'
  },
  {
    id: 'forest-trust', name: 'Forest Trust', moods: ['professional', 'calm', 'compliance'],
    primary: '#0F766E', secondary: '#134E4A', accent: '#D97706', background: '#F0FDF9', dark: '#0A2723'
  },
  {
    id: 'slate-steel', name: 'Slate Steel', moods: ['minimal', 'corporate', 'executive'],
    primary: '#334155', secondary: '#0F172A', accent: '#2563EB', background: '#F8FAFC', dark: '#0B1120'
  },
  {
    id: 'amber-noir', name: 'Amber Noir', moods: ['dark', 'cinematic', 'premium'],
    primary: '#F59E0B', secondary: '#B45309', accent: '#F87171', background: '#17130B', dark: '#0A0703'
  },
  {
    id: 'ocean-depth', name: 'Ocean Depth', moods: ['professional', 'tech', 'trust'],
    primary: '#0284C7', secondary: '#075985', accent: '#22D3EE', background: '#F0F9FF', dark: '#082033'
  },
  {
    id: 'coral-punch', name: 'Coral Punch', moods: ['energy', 'friendly', 'training'],
    primary: '#F43F5E', secondary: '#BE123C', accent: '#0EA5E9', background: '#FFF1F2', dark: '#27060D'
  },
  {
    id: 'lime-terminal', name: 'Lime Terminal', moods: ['tech', 'dark', 'hacker'],
    primary: '#84CC16', secondary: '#3F6212', accent: '#22D3EE', background: '#0C1206', dark: '#050803'
  },
  {
    id: 'royal-ink', name: 'Royal Ink', moods: ['executive', 'premium', 'policy'],
    primary: '#1E3A8A', secondary: '#172554', accent: '#CA8A04', background: '#F6F5F1', dark: '#101A38'
  },
  {
    id: 'sunset-brief', name: 'Sunset Brief', moods: ['warm', 'cinematic', 'story'],
    primary: '#EA580C', secondary: '#9A3412', accent: '#7C3AED', background: '#FFFBF5', dark: '#20110A'
  }
];

export const FONT_PAIRS = [
  { id: 'montserrat-inter', name: 'Montserrat / Inter', tones: ['corporate', 'default'], head: 'Montserrat', body: 'Inter' },
  { id: 'archivo-inter', name: 'Archivo Black / Inter', tones: ['bold', 'brutalist', 'energy'], head: 'Archivo Black', body: 'Inter' },
  { id: 'playfair-source', name: 'Playfair Display / Source Sans 3', tones: ['editorial', 'premium'], head: 'Playfair Display', body: 'Source Sans 3' },
  { id: 'space-ibm', name: 'Space Grotesk / IBM Plex Sans', tones: ['tech', 'futuristic'], head: 'Space Grotesk', body: 'IBM Plex Sans' },
  { id: 'bebas-open', name: 'Bebas Neue / Open Sans', tones: ['impact', 'urgent', 'alert'], head: 'Bebas Neue', body: 'Open Sans' },
  { id: 'merriweather-lato', name: 'Merriweather / Lato', tones: ['policy', 'trust', 'compliance'], head: 'Merriweather', body: 'Lato' },
  { id: 'poppins-roboto', name: 'Poppins / Roboto', tones: ['friendly', 'training'], head: 'Poppins', body: 'Roboto' },
  { id: 'oswald-nunito', name: 'Oswald / Nunito Sans', tones: ['cinematic', 'story'], head: 'Oswald', body: 'Nunito Sans' }
];

const paletteById = new Map(PALETTES.map((p) => [p.id, p]));
const fontPairById = new Map(FONT_PAIRS.map((f) => [f.id, f]));

export function getPalette(id) { return paletteById.get(String(id || '')) || null; }
export function getFontPair(id) { return fontPairById.get(String(id || '')) || null; }

/** Palettes whose moods intersect the wanted tags (all palettes when none match). */
export function palettesForMoods(tags = []) {
  const want = new Set(tags.map((t) => String(t).toLowerCase()));
  const hits = PALETTES.filter((p) => p.moods.some((m) => want.has(m)));
  return hits.length ? hits : PALETTES;
}

/** Font pairs whose tones intersect the wanted tags (default pair when none match). */
export function fontPairsForTones(tags = []) {
  const want = new Set(tags.map((t) => String(t).toLowerCase()));
  const hits = FONT_PAIRS.filter((f) => f.tones.some((t) => want.has(t)));
  return hits.length ? hits : [FONT_PAIRS[0]];
}
