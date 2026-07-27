// Composition root: builds the app's long-lived singletons (db, vault, bus,
// egress, studio harness) in one place so server.js and tests share wiring.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from './db.js';
import { seedIfAbsent } from './seed-db.js';
import { Vault } from '../masking/vault.js';
import { MaskingEgress } from '../masking/egress.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export function createAppContext({
  dataDir = join(HERE, '..', 'data'),
  logDir = join(HERE, '..', 'logs', 'runs'),
  dbPath = null,
  transports = {},
  egress: egressOverride = null // tests inject a fake egress here (no SDK/vault touch)
} = {}) {
  const runtimePath = dbPath || join(dataDir, 'poster-app.sqlite');
  // Fresh checkout/deploy: copy the committed read-only seed into place so the
  // shipped poster library is present on first run. No-op if a runtime DB
  // already exists (existing data preserved) or no seed is present (tests).
  seedIfAbsent(runtimePath, join(dataDir, 'poster-seed.sqlite'));
  const db = openDb(runtimePath);
  const bus = new EventBus({ logDir, db });
  const vault = new Vault({ db });
  const egress = egressOverride || new MaskingEgress({ vault, bus, db, transports });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine });
  return { db, bus, vault, egress, gateEngine, harness };
}
