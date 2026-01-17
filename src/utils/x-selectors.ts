import type { Page } from 'playwright';

export const selectors = {
  composeButton: [
    '[data-testid="SideNav_NewTweet_Button"]',
    '[aria-label="Post"]',
    'a[href="/compose/tweet"]',
    '[data-testid="tweetButtonInline"]'
  ],
  tweetInput: [
    '[data-testid="tweetTextarea_0"]',
    '[aria-label="Post text"]',
    '.public-DraftEditor-content',
    '[contenteditable="true"][data-testid="tweetTextarea_0"]',
    'div[role="textbox"]'
  ],
  postButton: [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
    'button[data-testid="tweetButtonInline"]',
    '[aria-label="Post"][role="button"]'
  ],
  profileIndicator: [
    '[data-testid="SideNav_AccountSwitcher_Button"]',
    '[aria-label*="Account menu"]',
    '[data-testid="AppTabBar_Profile_Link"]'
  ],
  rateLimitMessage: [
    'text=You are over the daily limit',
    'text=rate limit',
    'text=try again later'
  ],
  captchaFrame: [
    'iframe[src*="captcha"]',
    'iframe[title*="challenge"]',
    '[data-testid="captcha"]'
  ]
};

export async function findElement(page: Page, selectorList: string[], timeout = 10000): Promise<ReturnType<Page['locator']> | null> {
  for (const selector of selectorList) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: timeout / selectorList.length });
      return locator;
    } catch {
      continue;
    }
  }
  return null;
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  const profileElement = await findElement(page, selectors.profileIndicator, 5000);
  return profileElement !== null;
}

export async function detectRateLimit(page: Page): Promise<boolean> {
  for (const selector of selectors.rateLimitMessage) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  for (const selector of selectors.captchaFrame) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}
