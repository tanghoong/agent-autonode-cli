import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export const SECRETS_DIR = path.join(os.homedir(), '.taskpipe');
export const SECRETS_FILE = path.join(SECRETS_DIR, 'secrets.json');
export const KEY_FILE = path.join(SECRETS_DIR, 'key');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

interface EncryptedEntry {
  iv: string;
  authTag: string;
  ciphertext: string;
}

type SecretsStore = Record<string, EncryptedEntry>;

export function ensureSecretsDir(): void {
  if (!fs.existsSync(SECRETS_DIR)) {
    fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  }
}

function assertRegularFile(filePath: string): void {
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Expected regular file at ${filePath}`);
  }
}

export function loadOrCreateKey(): Buffer {
  ensureSecretsDir();
  if (fs.existsSync(KEY_FILE)) {
    assertRegularFile(KEY_FILE);
    fs.chmodSync(KEY_FILE, 0o600);
    const raw = fs.readFileSync(KEY_FILE);
    if (raw.length === KEY_LENGTH) return raw;
  }
  const key = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}

export function encrypt(value: string, key: Buffer): EncryptedEntry {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const authTag = (cipher as crypto.CipherGCM).getAuthTag();
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

export function decrypt(entry: EncryptedEntry, key: Buffer): string {
  const iv = Buffer.from(entry.iv, 'hex');
  const authTag = Buffer.from(entry.authTag, 'hex');
  const ciphertext = Buffer.from(entry.ciphertext, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

function loadStore(): SecretsStore {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as SecretsStore;
  } catch {
    return {};
  }
}

export function saveStore(store: SecretsStore): void {
  ensureSecretsDir();
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.chmodSync(SECRETS_FILE, 0o600);
}

/** Load and decrypt all secrets, returning a plaintext key-value map. */
export function loadSecrets(): Record<string, string> {
  const key = loadOrCreateKey();
  const store = loadStore();
  const result: Record<string, string> = {};
  for (const [k, entry] of Object.entries(store)) {
    try {
      result[k] = decrypt(entry, key);
    } catch {
      // Skip entries that cannot be decrypted (e.g. corrupted)
    }
  }
  return result;
}

/** Encrypt and persist a full key-value map of secrets. */
export function saveSecrets(secrets: Record<string, string>): void {
  const key = loadOrCreateKey();
  const store: SecretsStore = {};
  for (const [k, v] of Object.entries(secrets)) {
    store[k] = encrypt(v, key);
  }
  saveStore(store);
}
