/**
 * Marketing capture — Localhost Tunnel landing + docs.
 * Auth-required pages need a seeded user, deferred to a follow-up.
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const shotsDir = path.join(projectRoot, 'marketing', 'screenshots');
const videosDir = path.join(projectRoot, 'marketing', 'videos');
const BASE = process.env.BASE_URL || 'http://localhost:3008';

await fs.mkdir(shotsDir, { recursive: true });
await fs.mkdir(videosDir, { recursive: true });

const desktop = { width: 1920, height: 1080 };
const tablet = { width: 1024, height: 768 };
const mobile = { width: 390, height: 844 };

async function shot(page, name) {
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  + ${path.relative(projectRoot, file)}`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  console.log('\n[desktop]');
  {
    const ctx = await browser.newContext({ viewport: desktop });
    const page = await ctx.newPage();
    for (const [name, url] of [
      ['01-desktop-landing', '/en'],
      ['02-desktop-docs', '/en/docs'],
      ['03-desktop-api-docs', '/en/api-docs'],
      ['04-desktop-pricing', '/en/billing'],
    ]) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, name);
    }
    await ctx.close();
  }

  console.log('\n[tablet]');
  {
    const ctx = await browser.newContext({ viewport: tablet });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, '05-tablet-landing');
    await ctx.close();
  }

  console.log('\n[mobile]');
  {
    const ctx = await browser.newContext({
      viewport: mobile, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await ctx.newPage();
    for (const [name, url] of [
      ['06-mobile-landing', '/en'],
      ['07-mobile-docs', '/en/docs'],
      ['08-mobile-api-docs', '/en/api-docs'],
    ]) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, name);
    }
    await ctx.close();
  }

  console.log('\n=== walkthrough video ===');
  {
    const ctx = await browser.newContext({
      viewport: desktop,
      recordVideo: { dir: videosDir, size: desktop },
    });
    const page = await ctx.newPage();
    for (const url of ['/en', '/en/docs', '/en/api-docs', '/en/billing']) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(4500);
    }
    await ctx.close();
    console.log('  + walkthrough webm');
  }
} finally {
  await browser.close();
}
console.log('\nDone.');
