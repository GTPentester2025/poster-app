// Background presets — corporate-grade gradient, pattern, and texture presets.
// Works as both:
//   - ES module (import { ALL_PRESETS, PRESET_CATEGORIES, getPresetById } from '...')
//   - Browser script (<script src="..."> sets window.BACKGROUND_PRESETS)

export const PRESET_CATEGORIES = ['Corporate Gradients', 'Geometric Patterns', 'Subtle Textures'];

export const ALL_PRESETS = [
  // ══ CORPORATE GRADIENTS (15) ══
  { id: 'navy-teal', name: 'Navy to Teal', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'smooth diagonal gradient from deep navy blue #1B2A4A to teal #0D9488, clean modern corporate, no text', colors: ['#1B2A4A', '#0D9488'] },
  { id: 'slate-charcoal', name: 'Slate to Charcoal', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'subtle vertical gradient from slate gray #334155 to charcoal #1E293B, professional minimal, no text', colors: ['#334155', '#1E293B'] },
  { id: 'brand-gold', name: 'Brand Gold Fade', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'elegant gradient from warm gold #E3AF32 to clean white #FFFFFF, corporate brand feel, no text', colors: ['#E3AF32', '#FFFFFF'] },
  { id: 'dark-indigo', name: 'Dark to Indigo', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'deep gradient from near-black #0F172A to rich indigo #4338CA, dramatic corporate, no text', colors: ['#0F172A', '#4338CA'] },
  { id: 'forest-sage', name: 'Forest to Sage', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'organic gradient from deep forest green #064E3B to light sage #86EFAC, professional eco feel, no text', colors: ['#064E3B', '#86EFAC'] },
  { id: 'burgundy-gold', name: 'Burgundy to Gold', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'premium gradient from deep burgundy #7F1D1D to warm gold #F59E0B, executive feel, no text', colors: ['#7F1D1D', '#F59E0B'] },
  { id: 'steel-silver', name: 'Steel to Silver', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'metallic gradient from steel blue #475569 to silver #CBD5E1, modern tech corporate, no text', colors: ['#475569', '#CBD5E1'] },
  { id: 'midnight-royal', name: 'Midnight to Royal', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'dark gradient from midnight #0B1120 to royal blue #1E40AF, premium dark mode, no text', colors: ['#0B1120', '#1E40AF'] },
  { id: 'emerald-mint', name: 'Emerald to Mint', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'fresh gradient from emerald #047857 to mint #A7F3D0, clean corporate green, no text', colors: ['#047857', '#A7F3D0'] },
  { id: 'coral-peach', name: 'Coral to Peach', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'warm gradient from coral #E14B4B to soft peach #FED7AA, approachable corporate, no text', colors: ['#E14B4B', '#FED7AA'] },
  { id: 'plum-lavender', name: 'Plum to Lavender', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'elegant gradient from deep plum #581C87 to soft lavender #E9D5FF, creative corporate, no text', colors: ['#581C87', '#E9D5FF'] },
  { id: 'ocean-sky', name: 'Ocean to Sky', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'airy gradient from ocean blue #0369A1 to sky #BAE6FD, open professional feel, no text', colors: ['#0369A1', '#BAE6FD'] },
  { id: 'granite-pearl', name: 'Granite to Pearl', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'neutral gradient from granite gray #374151 to pearl white #F3F4F6, minimal professional, no text', colors: ['#374151', '#F3F4F6'] },
  { id: 'bronze-cream', name: 'Bronze to Cream', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'warm gradient from bronze #92400E to cream #FEF3C7, premium heritage feel, no text', colors: ['#92400E', '#FEF3C7'] },
  { id: 'arctic-frost', name: 'Arctic Frost', category: 'Corporate Gradients', treatment: 'gradient', prompt: 'cool gradient from icy blue #0C4A6E to frost white #F0F9FF, crisp corporate, no text', colors: ['#0C4A6E', '#F0F9FF'] },

  // ══ GEOMETRIC PATTERNS (8) ══
  { id: 'hex-grid', name: 'Hex Grid', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'subtle hexagonal grid pattern, thin lines, corporate professional, light background with dark lines, no text', colors: ['#F5F0E8', '#1F1A17'] },
  { id: 'dot-matrix', name: 'Dot Matrix', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'subtle dot matrix pattern, evenly spaced small dots, clean professional background, light with dark dots, no text', colors: ['#FFFFFF', '#334155'] },
  { id: 'diagonal-lines', name: 'Diagonal Lines', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'thin diagonal line pattern at 45 degrees, subtle and professional, light background, no text', colors: ['#F8FAFC', '#CBD5E1'] },
  { id: 'concentric-circles', name: 'Concentric Circles', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'subtle concentric circle pattern, thin outlines, modern corporate tech feel, light background, no text', colors: ['#F5F0E8', '#0D9488'] },
  { id: 'grid-lines', name: 'Grid Lines', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'fine grid line pattern like engineering paper, very subtle, light blue lines on white, professional, no text', colors: ['#FFFFFF', '#BAE6FD'] },
  { id: 'triangles-geo', name: 'Triangles Geo', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'low-poly triangle geometric pattern, subtle, modern corporate, light tones, no text', colors: ['#F1F5F9', '#475569'] },
  { id: 'waves-subtle', name: 'Subtle Waves', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'smooth subtle wave pattern, flowing lines, professional modern, light background, no text', colors: ['#F8FAFC', '#0D9488'] },
  { id: 'chevron-repeat', name: 'Chevron Repeat', category: 'Geometric Patterns', treatment: 'pattern', prompt: 'repeating chevron pattern, subtle thin lines, corporate professional, light background, no text', colors: ['#F5F0E8', '#1E293B'] },

  // ══ SUBTLE TEXTURES (5) ══
  { id: 'paper-fiber', name: 'Paper Fiber', category: 'Subtle Textures', treatment: 'pattern', prompt: 'subtle paper fiber texture, warm off-white, natural feel, minimal, professional, no text', colors: ['#F5F0E8'] },
  { id: 'linen-weave', name: 'Linen Weave', category: 'Subtle Textures', treatment: 'pattern', prompt: 'subtle linen fabric weave texture, elegant neutral tone, professional, no text', colors: ['#F1F5F9'] },
  { id: 'brushed-metal', name: 'Brushed Metal', category: 'Subtle Textures', treatment: 'pattern', prompt: 'subtle brushed metal texture, horizontal grain, light silver tone, modern corporate, no text', colors: ['#CBD5E1'] },
  { id: 'carbon-fiber', name: 'Carbon Fiber', category: 'Subtle Textures', treatment: 'pattern', prompt: 'subtle carbon fiber weave texture, dark tone, premium tech feel, no text', colors: ['#1E293B'] },
  { id: 'noise-grain', name: 'Noise Grain', category: 'Subtle Textures', treatment: 'pattern', prompt: 'very subtle noise grain texture, barely visible, adds depth to solid color background, no text', colors: ['#F8FAFC'] }
];

export function getPresetById(id) {
  return ALL_PRESETS.find((p) => p.id === id) || null;
}

// Browser compatibility: expose presets globally for the backgrounds page
if (typeof window !== 'undefined') {
  window.BACKGROUND_PRESETS = {
    ALL_PRESETS,
    CATEGORIES: PRESET_CATEGORIES
  };
}