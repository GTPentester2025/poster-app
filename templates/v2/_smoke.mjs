import { validateManifest, sampleContentFor } from './manifest_schema.js';
const PAL = { primary: '#1B2A4A', secondary: '#000000', accent: '#0D9488', background: '#F5F0E8', dark: '#1F1A17' };
const FONTS = { head: 'Montserrat', body: 'Inter', fallback: 'system-ui' };
const names = process.argv.slice(2);
for (const n of names) {
  let m;
  try { m = (await import('./' + n + '.js')).default; }
  catch (e) { console.log(n, 'IMPORT FAIL:', e.message); continue; }
  const problems = validateManifest(m);
  const content = sampleContentFor(m.contentSchema);
  let build = 'OK';
  try {
    m.build.portrait(content, PAL, FONTS);
    m.build.landscape(content, PAL, FONTS);
    m.preview.portrait(PAL);
    m.preview.landscape(PAL);
  } catch (e) { build = 'BUILD FAIL: ' + e.message + '\n' + e.stack; }
  console.log(n, '| validate:', problems.length ? problems : 'OK', '| build+preview:', build);
}
