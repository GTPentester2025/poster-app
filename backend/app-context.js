// Composition root: builds the app's long-lived singletons (db, vault, bus,
// egress, studio harness) in one place so server.js and tests share wiring.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBus } from '#shared';
import { GateEngine, Harness } from '#orchestration';
import { openDb } from './db.js';
import { Vault, defaultSecretsPath } from '../masking/vault.js';
import { MaskingEgress } from '../masking/egress.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

export function createAppContext({
  dataDir = join(HERE, '..', 'data'),
  logDir = join(HERE, '..', 'logs', 'runs'),
  dbPath = null,
  transports = {},
  egress: egressOverride = null // tests inject a fake egress here (no SDK/vault touch)
} = {}) {
  const db = openDb(dbPath || join(dataDir, 'poster-app.sqlite'));
  const bus = new EventBus({ logDir, db });
  const vault = new Vault({ db, secretsPath: defaultSecretsPath(dataDir) });
  const egress = egressOverride || new MaskingEgress({ vault, bus, db, transports });
  const gateEngine = new GateEngine({ bus });
  const harness = new Harness({ bus, gateEngine });
  return { db, bus, vault, egress, gateEngine, harness };
}
