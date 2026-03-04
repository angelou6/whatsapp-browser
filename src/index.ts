import BrowserHandler from "./browser.js";

(async function helloSelenium() {
  const browser = await BrowserHandler.init();
  await browser.goto("https://www.google.com");
  await browser.highlightElements();
  // await browser.quit();
})();
