// masking/model-capability.js
// Pure classifier: bucket an OpenAI-compatible model id into 'image' (image
// generation) vs 'text' (chat/completions). Heuristic by id — most /models
// endpoints don't advertise modality — so unknown ids default to 'text', the
// safe bucket for the content/vision roles. No I/O, unit-tested in isolation.

export const IMAGE_MODEL_PATTERNS = [
  /dall-?e/i,          // dall-e-3, dalle3
  /gpt-image/i,        // gpt-image-1
  /\bflux\b/i,         // flux.1-schnell, flux
  /stable-?diffusion/i,// stable-diffusion-xl
  /\bsdxl\b/i,         // sdxl-turbo
  /\bimagen\b/i,       // imagen-3
  /(^|[/_-])image($|[/_.:-])/i // segment 'image': org/some-image, foo-image
];

/**
 * @param {string} id model id
 * @returns {'image'|'text'}
 */
export function classifyModel(id) {
  const s = String(id ?? '');
  return IMAGE_MODEL_PATTERNS.some((re) => re.test(s)) ? 'image' : 'text';
}
