// First-run poster-library seeding.
//
// The runtime DB (data/poster-app.sqlite) is git-IGNORED: the app writes to it
// constantly, so tracking it in git makes every `git pull` conflict on a
// locally-modified binary — which is exactly why a pulled checkout stopped
// showing the shipped posters. Instead we commit a read-only SEED
// (data/poster-seed.sqlite) that the app NEVER writes, so `git pull` always
// updates it cleanly, and copy it into place on first run.

import { existsSync, copyFileSync } from 'node:fs';

/**
 * Copy the committed seed DB into the runtime path when the runtime DB does not
 * yet exist. No-op when the runtime DB is already present (existing data is
 * preserved), when there is no seed (tests / minimal deploys), or for the
 * in-memory DB used by tests.
 * @param {string} runtimePath path the app will open for read/write
 * @param {string} seedPath path to the committed read-only seed
 * @returns {boolean} true when a copy happened
 */
export function seedIfAbsent(runtimePath, seedPath) {
  if (!runtimePath || runtimePath === ':memory:') return false;
  if (existsSync(runtimePath)) return false;
  if (!seedPath || !existsSync(seedPath)) return false;
  copyFileSync(seedPath, runtimePath);
  return true;
}
