// Browser copy of masking/model-capability.js classifier. Keep the patterns in
// sync with the server module (both are pure; no bundler in this app).
export const IMAGE_MODEL_PATTERNS = [
  /dall-?e/i,          // dall-e-3, dalle3
  /gpt-image/i,        // gpt-image-1
  /\bflux\b/i,         // flux.1-schnell, flux
  /stable-?diffusion/i,// stable-diffusion-xl
  /\bsdxl\b/i,         // sdxl-turbo
  /\bimagen\b/i,       // imagen-3
  /(^|[/_-])image($|[/_.:-])/i // segment 'image': org/some-image, foo-image
];

export function classifyModel(id) {
  const s = String(id ?? '');
  return IMAGE_MODEL_PATTERNS.some((re) => re.test(s)) ? 'image' : 'text';
}
