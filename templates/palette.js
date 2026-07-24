// Brand palette + fonts for the design phase (spec §B.6 Path A). Defaults to
// AB InBev brand colors; the config page can override them with a
// user-supplied brand guideline (vault.getOrgConfig().brandOverride —
// {primary, secondary, accent, background, fontHead, fontBody} or null).
// Hex colors and font family names are styling, not org data — they never
// need masking, and canvas JSON references font FAMILY NAMES only (the UI
// page loads the actual font files).

export const DEFAULT_PALETTE = {
  primary: '#E3AF32', // AB InBev gold
  secondary: '#000000', // black
  accent: '#C8102E', // red
  background: '#F5F0E8', // warm paper
  dark: '#1F1A17' // near-black warm dark (text / dark panels)
};

export const DEFAULT_FONTS = {
  head: 'Montserrat', // headings — loaded via Google Fonts in the UI page
  body: 'Inter', // body — system sans fallback at render time
  fallback: 'system-ui, sans-serif'
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function pickHex(value, fallback) {
  return typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

function pickFont(value, fallback) {
  // font family names only — strip anything that could break out of a CSS/
  // canvas font-family value (quotes, semicolons, braces)
  const cleaned = typeof value === 'string' ? value.replace(/["';{}<>\\]/g, '').trim() : '';
  return cleaned || fallback;
}

/**
 * Merge a brandOverride (or null) over the AB InBev defaults.
 * @returns {{palette: object, fonts: object}}
 */
export function applyBrandOverride(brandOverride) {
  const b = brandOverride && typeof brandOverride === 'object' ? brandOverride : {};
  return {
    palette: {
      primary: pickHex(b.primary, DEFAULT_PALETTE.primary),
      secondary: pickHex(b.secondary, DEFAULT_PALETTE.secondary),
      accent: pickHex(b.accent, DEFAULT_PALETTE.accent),
      background: pickHex(b.background, DEFAULT_PALETTE.background),
      dark: DEFAULT_PALETTE.dark // derived anchor for text contrast; not overridable
    },
    fonts: {
      head: pickFont(b.fontHead, DEFAULT_FONTS.head),
      body: pickFont(b.fontBody, DEFAULT_FONTS.body),
      fallback: DEFAULT_FONTS.fallback
    }
  };
}

/** Resolve palette+fonts from a vault (or vault-less test ctx). */
export function resolveBrand(vault) {
  const override = vault ? vault.getOrgConfig().brandOverride : null;
  return applyBrandOverride(override);
}
