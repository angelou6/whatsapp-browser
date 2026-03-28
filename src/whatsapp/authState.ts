import {
  BufferJSON,
  initAuthCreds,
  makeCacheableSignalKeyStore,
} from "baileys";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

export function useAuthState() {
  mkdirSync("./auth", { recursive: true });
  const db = new Database("./auth/auth.db");

  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`PRAGMA synchronous = NORMAL`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT
  `);

  const stmtGet = db.prepare("SELECT value FROM auth WHERE key = ?").pluck();
  const stmtUpsert = db.prepare(
    "INSERT OR REPLACE INTO auth (key, value) VALUES (?, ?)",
  );
  const stmtDelete = db.prepare("DELETE FROM auth WHERE key = ?");

  const get = (key: string) => {
    const value = stmtGet.get(key);
    return value ? JSON.parse(String(value), BufferJSON.reviver) : null;
  };

  const set = (key: string, value: unknown | null) => {
    if (value != null) {
      stmtUpsert.run(key, JSON.stringify(value, BufferJSON.replacer));
    } else {
      stmtDelete.run(key);
    }
  };

  const writeKeysTxn = db.transaction(
    (data: Record<string, Record<string, unknown>>) => {
      for (const [type, ids] of Object.entries(data)) {
        for (const [id, value] of Object.entries(ids)) {
          set(`key:${type}:${id}`, value);
        }
      }
    },
  );

  const creds = get("creds") ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: makeCacheableSignalKeyStore({
        get: async (type, ids) => {
          const result: Record<string, any> = {};
          for (const id of ids) {
            const val = get(`key:${type}:${id}`);
            if (val) result[id] = val;
          }
          return result;
        },
        set: async (data) => {
          writeKeysTxn(data as Record<string, Record<string, unknown>>);
        },
      }),
    },
    saveCreds: () => set("creds", creds),
  };
}

export function clearAuthState() {
  const db = new Database("./auth/auth.db");
  db.exec("DELETE FROM auth");
}
