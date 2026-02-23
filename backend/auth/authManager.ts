import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { AuthConfig } from '../types.js';

export interface AuthSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  startedAt: number;
}

export async function startAuthSession(baseUrl: string, auth?: AuthConfig): Promise<AuthSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const loginUrl = auth?.loginUrl?.trim() || baseUrl;
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  if (auth?.username && auth?.usernameSelector) {
    await page.locator(auth.usernameSelector).first().fill(auth.username).catch(() => undefined);
  }
  if (auth?.password && auth?.passwordSelector) {
    await page.locator(auth.passwordSelector).first().fill(auth.password).catch(() => undefined);
  }
  if (auth?.otp && auth?.otpSelector) {
    await page.locator(auth.otpSelector).first().fill(auth.otp).catch(() => undefined);
  }
  if (auth?.submitSelector) {
    await page.locator(auth.submitSelector).first().click().catch(() => undefined);
  }

  return { browser, context, page, startedAt: Date.now() };
}

export async function detectAuthSuccess(session: AuthSession, auth?: AuthConfig): Promise<boolean> {
  const { page } = session;
  const successSelector = auth?.successSelector?.trim();
  const successUrlIncludes = auth?.successUrlIncludes?.trim();

  if (successSelector) {
    const ok = await page.locator(successSelector).first().isVisible().catch(() => false);
    if (ok) return true;
  }

  if (successUrlIncludes && page.url().includes(successUrlIncludes)) return true;

  if (auth?.qrEnabled && page.url().includes('web.whatsapp.com')) {
    const qrVisible = await page.locator('canvas[aria-label*="Scan"]').first().isVisible().catch(() => false);
    if (!qrVisible) return true;
  }

  const cookies = await page.context().cookies();
  return cookies.length > 0 && !page.url().includes('login');
}

export async function persistAuth(session: AuthSession, storageStatePath: string): Promise<void> {
  await session.context.storageState({ path: storageStatePath });
}

export async function closeAuthSession(session: AuthSession | null): Promise<void> {
  if (!session) return;
  await session.context.close().catch(() => undefined);
  await session.browser.close().catch(() => undefined);
}
