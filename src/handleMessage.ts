import type BrowserHandler from "./browser.js";
import type { DownloadQuality, DownloadType } from "./ytdlp.js";

export type MessageResult =
  | { type: "text"; text: string }
  | { type: "image"; image: Buffer }
  | { type: "document"; path: string; mimetype: string; fileName: string };

export async function handleBrowserCommand(
  browser: BrowserHandler,
  text: string,
): Promise<MessageResult[]> {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);

  switch (cmd) {
    case "go": {
      const url = args[0];
      if (!url) return [{ type: "text", text: "Uso: go <url>" }];
      await browser.goto(url);
      const ssGoto = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssGoto) }];
    }

    case "goh": {
      const url = args[0];
      if (!url) return [{ type: "text", text: "Uso: go <url>" }];
      await browser.goto(url);
      const ssGoto = await browser.highlightElements();
      return [{ type: "image", image: Buffer.from(ssGoto) }];
    }

    case "screenshot": {
      const image = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(image) }];
    }

    case "highlight":
    case "hg": {
      const image = await browser.highlightElements();
      return [{ type: "image", image: Buffer.from(image) }];
    }

    case "click": {
      const idx = parseInt(args[0] ?? "");
      if (isNaN(idx)) return [{ type: "text", text: "Uso: click <numero>" }];
      await browser.clickWithTarget(idx);
      const ssClick = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssClick) }];
    }

    case "write": {
      const idx = parseInt(args[0] ?? "");
      const writeText = args.slice(1).join(" ");
      if (isNaN(idx) || !writeText)
        return [{ type: "text", text: "Uso: write <numero> <texto>" }];
      await browser.writeWithTarget(idx, writeText);
      const ssWrite = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssWrite) }];
    }

    case "pageup": {
      await browser.pageup();
      const ssPu = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssPu) }];
    }

    case "pagedown": {
      await browser.pagedown();
      const ssPd = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssPd) }];
    }

    case "text": {
      const bodyText = await browser.getBodyText();
      const truncated =
        bodyText.length > 4000 ? bodyText.slice(0, 4000) + "..." : bodyText;
      return [{ type: "text", text: truncated }];
    }

    case "download": {
      const isType = (value: string | undefined): value is DownloadType =>
        value === "video" || value === "audio";
      const isQuality = (value: string | undefined): value is DownloadQuality =>
        value === "worst" || value === "normal" || value === "best";

      let dlType: DownloadType = "video";
      let dlQuality: DownloadQuality = "worst";
      let dlUrl: string | undefined;
      let i = 0;

      const maybeType = args[i];
      if (isType(maybeType)) {
        dlType = maybeType;
        i++;
      }

      const maybeQuality = args[i];
      if (isQuality(maybeQuality)) {
        dlQuality = maybeQuality;
        i++;
      }

      if (args[i]?.startsWith("http")) {
        dlUrl = args[i];
        i++;
      }

      const maybeQualityAfterUrl = args[i];
      if (isQuality(maybeQualityAfterUrl)) {
        dlQuality = maybeQualityAfterUrl;
        i++;
      }

      if (args[i]) {
        return [
          {
            type: "text",
            text: "Uso: download [video|audio] [worst|normal|best] [url]",
          },
        ];
      }

      const filePath = await browser.downloadWithYtDlp(
        dlType,
        dlUrl,
        dlQuality,
      );
      const ext = filePath.split(".").pop() || "";
      const mime = dlType === "audio" ? "audio/mpeg" : "video/mp4";
      const fileName = filePath.split(/[/\\]/).pop() || `download.${ext}`;
      return [{ type: "document", path: filePath, mimetype: mime, fileName }];
    }

    case "ping": {
      return [
        {
          type: "text",
          text: "pong!",
        },
      ];
    }

    case "help": {
      return [
        {
          type: "text",
          text: [
            "*Comandos disponibles:*",
            "go <url> - Navegar a URL",
            "goh <url> - Navegar a URL y resalta los elementos",
            "screenshot - Captura de pantalla",
            "highlight | hg - Resaltar elementos",
            "click <n> - Click en elemento n",
            "write <n> <texto> - Escribir en elemento n",
            "pageup - Scroll arriba",
            "pagedown - Scroll abajo",
            "text - Texto de la pagina",
            "download [video|audio] [worst|normal|best] [url]",
          ].join("\n"),
        },
      ];
    }

    default:
      return [
        {
          type: "text",
          text: `Comando desconocido: "${cmd}". Escribe "help" para ver los comandos.`,
        },
      ];
  }
}
