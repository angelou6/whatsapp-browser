import { Browser, Builder, type WebDriver } from "selenium-webdriver";

export default class BrowserHandler {
  driver: WebDriver;

  private constructor(driver: WebDriver) {
    this.driver = driver;
  }

  public static async init(
    defaultBrowser: "chrome" | "firefox" | "edge" = "firefox",
  ) {
    let browser: string = Browser.FIREFOX;
    if (defaultBrowser === "edge") {
      browser = Browser.EDGE;
    } else if (defaultBrowser === "chrome") {
      browser = Browser.CHROME;
    }

    const driver = await new Builder().forBrowser(browser).build();
    const instance = new BrowserHandler(driver);
    return instance;
  }

  public async goto(url: string) {
    await this.driver.get(url);
  }

  public async quit() {
    await this.driver.quit();
  }
}
