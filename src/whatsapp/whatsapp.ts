import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "baileys";
import { readFile } from "node:fs/promises";
import P from "pino";
import QRCode from "qrcode";
import { clearAuthState, useAuthState } from "./authState.js";
import BrowserHandler from "../browser.js";
import { handleBrowserCommand } from "./handleMessage.js";

export async function connect() {
  const { state, saveCreds } = useAuthState();
  let browser: BrowserHandler | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const scheduleReconnect = (reason: string, delayMs = 3000) => {
    if (reconnectTimer) {
      return;
    }

    console.log(`Reconectando en ${delayMs / 1000}s (${reason})...`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void startSocket();
    }, delayMs);
  };

  async function startSocket() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    if (!isLatest) {
      console.log(`Usando version WA Web ${version.join(".")}.`);
    }
    const sock = makeWASocket({
      auth: state,
      logger: P({ level: "error" }),
      version,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrText = await QRCode.toString(qr, {
          type: "terminal",
          small: true,
          errorCorrectionLevel: "L",
        });
        console.log("\nEscanea este QR en WhatsApp:\n");
        console.log(qrText);
      }

      if (connection === "open") {
        console.log("Conectado a WhatsApp.");
        if (!browser) {
          console.log("Iniciando navegador...");
          browser = await BrowserHandler.init();
          console.log("Navegador listo.");
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const reason =
          (lastDisconnect?.error as Error | undefined)?.message ||
          "sin detalle";

        console.log(
          `Conexion cerrada. status=${statusCode ?? "n/a"} reason=${reason}`,
        );

        if (statusCode === DisconnectReason.loggedOut) {
          console.log(
            "Sesion cerrada en WhatsApp. Reiniciando estado para pedir QR nuevo.",
          );
          clearAuthState();
          scheduleReconnect("sesion cerrada", 1500);
          return;
        }

        scheduleReconnect("conexion cerrada");
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid!;
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        if (!text) return;

        if (!browser) {
          await sock.sendMessage(jid, {
            text: "Navegador no esta listo todavia.",
          });
          return;
        }

        await sock.sendPresenceUpdate("composing", jid);

        try {
          const results = await handleBrowserCommand(browser, text);

          for (const result of results) {
            switch (result.type) {
              case "text":
                await sock.sendMessage(jid, { text: result.text });
                break;
              case "image":
                await sock.sendMessage(jid, {
                  image: result.image,
                });
                break;
              case "document": {
                const buffer = await readFile(result.path);
                await sock.sendMessage(jid, {
                  document: buffer,
                  mimetype: result.mimetype,
                  fileName: result.fileName,
                });
                break;
              }
            }
          }
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : "Error desconocido";
          await sock.sendMessage(jid, { text: `Error: ${errMsg}` });
        }

        await sock.sendPresenceUpdate("paused", jid);
      }
    });
  }

  await startSocket();
}
