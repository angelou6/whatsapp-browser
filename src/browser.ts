import {
  Browser,
  Builder,
  By,
  WebElement,
  type WebDriver,
} from "selenium-webdriver";

import { download, type DownloadQuality, type DownloadType } from "./ytdlp.js";

type SelectorType = "class" | "css" | "id" | "linktext" | "partiallink";
type BrowserType = "chrome" | "firefox" | "edge";

export default class BrowserHandler {
  driver: WebDriver;
  clickableElements: WebElement[] | null;

  private constructor(driver: WebDriver) {
    this.driver = driver;
    this.clickableElements = null;
  }

  public static async init(defaultBrowser: BrowserType = "firefox") {
    let browser: string;
    switch (defaultBrowser) {
      case "chrome":
        browser = Browser.CHROME;
        break;
      case "edge":
        browser = Browser.EDGE;
        break;
      default:
        browser = Browser.FIREFOX;
        break;
    }

    const driver = await new Builder().forBrowser(browser).build();
    const instance = new BrowserHandler(driver);
    return instance;
  }

  private completeUrl(url: string) {
    if (!/^https?:\/\//.test(url)) {
      return "http://" + url;
    }
    return url;
  }

  public async goto(url: string) {
    const completeUrl = this.completeUrl(url);
    await this.driver.get(completeUrl);
  }

  private async getElementBySelector(type: SelectorType, selector: string) {
    let bySelector: By;
    switch (type) {
      case "class":
        bySelector = By.className(selector);
        break;
      case "css":
        bySelector = By.css(selector);
        break;
      case "id":
        bySelector = By.id(selector);
        break;
      case "linktext":
        bySelector = By.linkText(selector);
        break;
      case "partiallink":
        bySelector = By.partialLinkText(selector);
        break;
      default:
        throw new Error("Selector desconocido.");
    }
    return await this.driver.findElement(bySelector);
  }

  public async screenshot() {
    return await this.driver.takeScreenshot();
  }

  public async highlightElements() {
    const selector = `
      a, button, input, select, textarea, 
      [onclick], [role='button'], [role='link'], 
      [role='checkbox'], [role='radio'], [role='menuitem'], 
      [role='tab'], [tabindex]
    `;

    const candidates = await this.driver.findElements(By.css(selector));
    const elements = candidates.filter(
      async (el) => (await el.isDisplayed()) && (await el.isEnabled()),
    );

    await this.driver.executeScript(
      `
      const elements = arguments[0];
      const ids = [];

      elements.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) { ids.push(null); return; }

        const overlay = document.createElement('div');
        overlay.id = '__sel_overlay_' + i;
        overlay.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${rect.top}px;
          width: \${rect.width}px;
          height: \${rect.height}px;
          border: 2px solid #FF3B3B;
          background: rgba(255, 59, 59, 0.15);
          box-sizing: border-box;
          pointer-events: none;
          z-index: 2147483647;
        \`;
        document.body.appendChild(overlay);

        const badge = document.createElement('div');
        badge.id = '__sel_badge_' + i;
        badge.textContent = i + 1;
        badge.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${rect.top - 18 < 0 ? rect.top : rect.top - 18}px;
          background: #FF3B3B;
          color: white;
          font: bold 11px monospace;
          padding: 1px 4px;
          border-radius: 3px;
          pointer-events: none;
          z-index: 2147483647;
          line-height: 16px;
        \`;
        document.body.appendChild(badge);

        ids.push(i);
      });

      return ids;
      `,
      elements,
    );

    this.clickableElements = elements;

    const screenshot = await this.screenshot();

    await this.driver.executeScript(`
      document.querySelectorAll('[id^="__sel_overlay_"], [id^="__sel_badge_"]')
        .forEach(el => el.remove());
    `);

    return screenshot;
  }

  public async clickWithElements(idx: number) {
    if (this.clickableElements === null) {
      throw new Error("No hay elementos conocidos");
    }

    try {
      this.clickableElements[idx]?.click();
    } catch (_error) {
      throw new Error("Error al dar click al elemento. ¿Existe?");
    }
  }

  public async clickWithSelector(type: SelectorType, selector: string) {
    const element = await this.getElementBySelector(type, selector);
    element.click();
  }

  public async downloadWithYtDlp(
    type: DownloadType = "video",
    url: string | undefined,
    quality: DownloadQuality = "worst",
  ) {
    let downloadUrl = url ? url : await this.driver.getCurrentUrl();
    return await download(type, downloadUrl, quality);
  }

  public async quit() {
    await this.driver.quit();
  }
}
