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
    case "goto": {
      const url = args[0];
      if (!url) return [{ type: "text", text: "Uso: goto <url>" }];
      await browser.goto(url);
      const ssGoto = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssGoto) }];
    }

    case "screenshot": {
      const image = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(image) }];
    }

    case "highlight": {
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
      const dlType = (args[0] as DownloadType) || "video";
      const dlUrl = args[1] || undefined;
      const dlQuality = (args[2] as DownloadQuality) || "worst";
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

    case "help": {
      return [
        {
          type: "text",
          text: [
            "*Comandos disponibles:*",
            "goto <url> - Navegar a URL",
            "screenshot - Captura de pantalla",
            "highlight - Resaltar elementos",
            "click <n> - Click en elemento n",
            "write <n> <texto> - Escribir en elemento n",
            "pageup - Scroll arriba",
            "pagedown - Scroll abajo",
            "text - Texto de la pagina",
            "download [video|audio] [url] [worst|normal|best]",
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
