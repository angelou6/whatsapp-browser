import {
  BufferJSON,
  initAuthCreds,
  makeCacheableSignalKeyStore,
} from "baileys";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function useAuthState() {
  mkdirSync("./auth", { recursive: true });
  const db = new DatabaseSync("./auth/auth.db");

  db.exec(`PRAGMA journal_mode = WAL`);
  db.exec(`PRAGMA synchronous = NORMAL`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT
  `);

  const stmtGet = db.prepare("SELECT value FROM auth WHERE key = ?");
  const stmtUpsert = db.prepare(
    "INSERT OR REPLACE INTO auth (key, value) VALUES (?, ?)",
  );
  const stmtDelete = db.prepare("DELETE FROM auth WHERE key = ?");

  const get = (key: string) => {
    const row = stmtGet.get(key);
    return row ? JSON.parse(String(row.value), BufferJSON.reviver) : null;
  };

  const set = (key: string, value: string | null) => {
    if (value != null) {
      stmtUpsert.run(key, JSON.stringify(value, BufferJSON.replacer));
    } else {
      stmtDelete.run(key);
    }
  };

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
          db.exec("BEGIN");
          try {
            for (const [type, ids] of Object.entries(data)) {
              for (const [id, value] of Object.entries(ids)) {
                set(`key:${type}:${id}`, value);
              }
            }
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        },
      }),
    },
    saveCreds: () => set("creds", creds),
  };
}

export function clearAuthState() {
  const db = new DatabaseSync("./auth.db");
  db.exec("DELETE FROM auth");
}
