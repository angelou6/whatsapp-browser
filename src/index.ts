import BrowserHandler from "./browser.js";

const browser = await BrowserHandler.init();
try {
  await browser.goto("https://www.duck.com");
  // await browser.goto("en.wikipedia.org/wiki/Duck");
  await browser.highlightElements();
  await browser.writeWithTarget(11, "this is test uwu");
  // console.log(await browser.getBodyText());
  // browser.quit();
} catch (error) {
  browser.quit();
  console.error(error);
}
