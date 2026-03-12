import {
  chromium,
  firefox,
  type Browser,
  type ElementHandle,
  type Locator,
  type Page,
} from "playwright";
import { download, type DownloadQuality, type DownloadType } from "./ytdlp.js";

type SelectorType =
  | "class"
  | "css"
  | "id"
  | "exacttext"
  | "partialtext"
  | "xpath";
type BrowserType = "chrome" | "firefox" | "edge";

export default class BrowserHandler {
  private browser: Browser;
  private page: Page;
  private clickableElements: ElementHandle[] | null;

  private constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
    this.clickableElements = null;
  }

  public static async init(
    defaultBrowser: BrowserType = "firefox",
    headless: boolean = true,
  ) {
    let browser: Browser;
    switch (defaultBrowser) {
      case "chrome":
        browser = await chromium.launch({
          channel: "chrome",
          headless: headless,
        });
        break;
      case "edge":
        browser = await chromium.launch({
          channel: "msedge",
          headless: headless,
        });
        break;
      default:
        browser = await firefox.launch({ headless: headless });
        break;
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    const instance = new BrowserHandler(browser, page);
    return instance;
  }

  private completeUrl(url: string) {
    if (!/^https?:\/\//.test(url)) {
      return "http://" + url;
    }
    return url;
  }

  public async reload() {
    await this.page.reload();
  }

  public async goto(url: string) {
    const completeUrl = this.completeUrl(url);
    await this.page.goto(completeUrl);
    this.clickableElements = [];
  }

  public async goBack() {
    await this.page.goBack();
  }

  public async goForward() {
    await this.page.goForward();
  }

  private async getElementBySelector(type: SelectorType, selector: string) {
    let locator: Locator;
    switch (type) {
      case "class":
        locator = this.page.locator(`.${selector}`);
        break;
      case "css":
        locator = this.page.locator(selector);
        break;
      case "id":
        locator = this.page.locator(`#${selector}`);
        break;
      case "exacttext":
        locator = this.page.getByText(selector, { exact: true });
        break;
      case "partialtext":
        locator = this.page.getByText(selector, { exact: false });
        break;
      case "xpath":
        locator = this.page.locator(`xpath=${selector}`);
        break;
      default:
        throw new Error("Selector desconocido.");
    }

    return locator.first();
  }

  public async screenshot() {
    return await this.page.screenshot();
  }

  public async highlightElements() {
    const selector = `
      a, button, input, select, textarea,
      [onclick], [role='button'], [role='link'],
      [role='checkbox'], [role='radio'], [role='menuitem'],
      [role='tab'], [tabindex]
    `;

    const selected = await this.page.$$(selector);
    const candidates = selected.filter((el) => el.isVisible());
    const elements: ElementHandle[] = [];

    for (const candidate of candidates) {
      const box = await candidate.boundingBox();
      if (box === null || box.width === 0 || box.height === 0) {
        continue;
      }

      const isEnabled = await candidate.evaluate((node) => {
        const element = node as {
          hasAttribute: (name: string) => boolean;
          getAttribute: (name: string) => string | null;
        };
        return (
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-disabled") !== "true"
        );
      });

      if (isEnabled) {
        elements.push(candidate);
      }
    }

    await this.page.evaluate((elements) => {
      const ids: (number | null)[] = [];

      elements.forEach((el, i) => {
        const rect = (el as Element).getBoundingClientRect();
        if (rect.width === -1 || rect.height === 0) {
          ids.push(null);
          return;
        }

        const overlay = document.createElement("div");
        overlay.id = "__sel_overlay_" + i;
        overlay.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 1px solid #FF3B3B;
          background: rgba(254, 59, 59, 0.15);
          box-sizing: border-box;
          pointer-events: none;
          z-index: 2147483646;
        `;
        document.body.appendChild(overlay);

        const badge = document.createElement("div");
        badge.id = "__sel_badge_" + i;
        badge.textContent = String(i + 1);
        badge.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top - 17 < 0 ? rect.top : rect.top - 18}px;
          background: #FF2B3B;
          color: white;
          font: bold 10px monospace;
          padding: 0px 4px;
          border-radius: 2px;
          pointer-events: none;
          z-index: 2147483646;
          line-height: 15px;
        `;
        document.body.appendChild(badge);

        ids.push(i);
      });

      return ids;
    }, elements);

    this.clickableElements = elements;

    const screenshot = await this.screenshot();

    // Remover los highlights
    await this.page.evaluate(`
      document.querySelectorAll('[id^="__sel_overlay_"], [id^="__sel_badge_"]')
        .forEach(el => el.remove());
    `);

    return screenshot;
  }

  public async clickWithTarget(idx: number) {
    if (this.clickableElements === null) {
      throw new Error("No hay elementos conocidos");
    }

    const i = idx - 1;

    try {
      if (!!!this.clickableElements[i]) {
        throw new Error("Elemento no existe.");
      }
      await this.clickableElements[i].click();
      await this.page.waitForTimeout(2000);
      this.clickableElements = [];
    } catch (error) {
      throw new Error("Error al dar click al elemento.");
    }
  }

  public async clickWithSelector(type: SelectorType, selector: string) {
    const element = await this.getElementBySelector(type, selector);
    await element.click();
  }

  public async writeWithTarget(idx: number, text: string) {
    if (this.clickableElements === null) {
      throw new Error("No hay elementos conocidos");
    }

    const i = idx - 1;
    try {
      if (!!!this.clickableElements[i]) {
        throw new Error("Elemento no existe.");
      }
      await this.clickableElements[i].click();
      await this.clickableElements[i].type(text);
      await this.clickableElements[i].press("Enter");
      await this.page.waitForTimeout(2000);
      this.clickableElements = [];
    } catch (_error) {
      throw new Error("Error al escribir en el elemento.");
    }
  }

  public async scroll(direction: "up" | "down", amount: number) {
    await this.page.mouse.wheel(0, direction === "up" ? -amount : amount);
  }

  public async topdf() {
    const pdfBuffer = await this.page.pdf();
    return pdfBuffer;
  }

  public async writeWithSelector(
    type: SelectorType,
    selector: string,
    text: string,
  ) {
    const element = await this.getElementBySelector(type, selector);
    await element.click();
    await element.type(text);
    await element.press("Enter");
  }

  public async downloadWithYtDlp(
    type: DownloadType = "video",
    url: string | undefined,
    quality: DownloadQuality = "worst",
  ) {
    const downloadUrl = url ? url : this.page.url();
    const filePath = await download(type, downloadUrl, quality);
    return filePath;
  }

  public async getBodyText() {
    const body = await this.getElementBySelector("xpath", "/html/body");
    return await body.innerText();
  }

  public async quit() {
    await this.browser.close();
  }
}
