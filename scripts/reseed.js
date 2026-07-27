// Force the runtime DB back to the shipped poster library.
//
// Use on an existing checkout that already has a runtime data/poster-app.sqlite
// without the committed posters (seed-on-first-run only fires when the runtime
// DB is ABSENT). Stops nothing — run it with the server stopped. The current
// runtime DB is backed up to poster-app.sqlite.bak first; stale WAL/SHM
// sidecars are removed so the fresh copy opens clean.

import { existsSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
const seed = join(dataDir, 'poster-seed.sqlite');
const runtime = join(dataDir, 'poster-app.sqlite');

if (!existsSync(seed)) {
  console.error('No data/poster-seed.sqlite found — pull the latest code first.');
  process.exit(1);
}

if (existsSync(runtime)) {
  copyFileSync(runtime, `${runtime}.bak`);
  console.log('Backed up existing runtime DB → data/poster-app.sqlite.bak');
}
for (const sidecar of [`${runtime}-wal`, `${runtime}-shm`]) {
  if (existsSync(sidecar)) rmSync(sidecar);
}
copyFileSync(seed, runtime);
console.log('Reseeded data/poster-app.sqlite from the shipped library. Restart the app.');
