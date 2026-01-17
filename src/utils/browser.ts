import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), 'auth.json');

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launchBrowser(headless = false): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  let context: BrowserContext;

  if (existsSync(AUTH_FILE)) {
    const cookies = JSON.parse(await readFile(AUTH_FILE, 'utf-8'));
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US'
    });
    await context.addCookies(cookies);
  } else {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US'
    });
  }

  const page = await context.newPage();
  return { browser, context, page };
}

export async function saveCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  await writeFile(AUTH_FILE, JSON.stringify(cookies, null, 2));
  console.log(`Cookies saved to ${AUTH_FILE}`);
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  await session.page.close();
  await session.context.close();
  await session.browser.close();
}

export function hasAuthFile(): boolean {
  return existsSync(AUTH_FILE);
}

export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const filepath = path.join(screenshotsDir, filename);

  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}
