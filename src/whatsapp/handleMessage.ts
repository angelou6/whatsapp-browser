import type BrowserHandler from "../browser.js";
import type { DownloadQuality, DownloadType } from "../ytdlp.js";

export type MessageResult =
  | { type: "text"; text: string }
  | { type: "image"; image: Buffer }
  | { type: "document"; path: string; mimetype: string; fileName: string };

async function search(
  browser: BrowserHandler,
  url: string,
  query: string,
  highlight: boolean,
): Promise<MessageResult[]> {
  await browser.goto(`${url}?q=${encodeURIComponent(query)}`);
  if (highlight) {
    const ssHighlight = await browser.highlightElements();
    return [{ type: "image", image: Buffer.from(ssHighlight) }];
  }
  const ssGoogle = await browser.screenshot();
  return [{ type: "image", image: Buffer.from(ssGoogle) }];
}

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
      const highlight = args[0] === "h" || args[0] === "highlight";

      if (!url) return [{ type: "text", text: "Uso: go <url>" }];
      try {
        await browser.goto(url);
        if (highlight) {
          const ssHighlight = await browser.highlightElements();
          return [{ type: "image", image: Buffer.from(ssHighlight) }];
        }
        const ssGoto = await browser.screenshot();
        return [{ type: "image", image: Buffer.from(ssGoto) }];
      } catch (error) {
        console.error("Error navegando a la URL", error);
        return [
          {
            type: "text",
            text: "Error navegando a la URL. ¿Es válida?",
          },
        ];
      }
    }

    case "back": {
      await browser.goBack();
      const ssBack = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssBack) }];
    }

    case "forward": {
      await browser.goForward();
      const ssForward = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssForward) }];
    }

    case "google": {
      const query = args.join(" ");
      const highlight = args[0] === "h" || args[0] === "highlight";
      if (!query) return [{ type: "text", text: "Uso: google <consulta>" }];
      return await search(
        browser,
        "https://www.google.com/search",
        query,
        highlight,
      );
    }

    case "duck": {
      const query = args.join(" ");
      const highlight = args[0] === "h" || args[0] === "highlight";
      if (!query) return [{ type: "text", text: "Uso: duck <consulta>" }];
      return await search(browser, "https://duckduckgo.com/", query, highlight);
    }

    case "reload": {
      await browser.reload();
      const ssRefresh = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssRefresh) }];
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

    case "scroll": {
      const direction = args[0] === "up" ? "up" : "down";
      const amount = parseInt(args[1] ?? "100");
      if (isNaN(amount))
        return [{ type: "text", text: "Uso: scroll up|down <cantidad>" }];
      await browser.scroll(direction, amount);
      const ssScroll = await browser.screenshot();
      return [{ type: "image", image: Buffer.from(ssScroll) }];
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
            "go h? <url> - Navegar a URL",
            "back - Volver a la pagina anterior",
            "forward - Ir a la pagina siguiente",
            "google h? <query> - Buscar en Google",
            "duck h? <query> - Buscar en DuckDuckGo",
            "reload - Refrescar la pagina",
            "screenshot - Captura de pantalla",
            "highlight | hg - Resaltar elementos",
            "click <n> - Click en elemento n",
            "write <n> <texto> - Escribir en elemento n",
            "scroll [up|down] <cantidad> - Scroll hacia arriba o abajo",
            "text - Texto de la pagina",
            "download [video|audio]? [worst|normal|best]? [url]",
            "help - Mostrar este mensaje",
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
