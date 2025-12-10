import { test, expect } from '@playwright/test';

test.describe('Localhost Tunnel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en');
  });

  test('should show home page', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/01-home-en.png', fullPage: true });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should navigate to dashboard', async ({ page }) => {
    await page.goto('/en/dashboard');
    await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show tunnel creation form', async ({ page }) => {
    await page.goto('/en/tunnels/new');
    await page.screenshot({ path: 'screenshots/03-create-tunnel.png', fullPage: true });

    await expect(page.locator('[data-testid="port-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="subdomain-input"]')).toBeVisible();
  });

  test('should show tunnels list', async ({ page }) => {
    await page.goto('/en/tunnels');
    await page.screenshot({ path: 'screenshots/04-tunnels-list.png', fullPage: true });
    await expect(page.locator('h1')).toContainText('Tunnels');
  });

  test('should show analytics', async ({ page }) => {
    await page.goto('/en/analytics');
    await page.screenshot({ path: 'screenshots/05-analytics.png', fullPage: true });
    await expect(page.locator('h1')).toContainText('Analytics');
  });

  test('should show documentation', async ({ page }) => {
    await page.goto('/en/docs');
    await page.screenshot({ path: 'screenshots/06-docs.png', fullPage: true });
    await expect(page.locator('h1')).toContainText('Documentation');
  });

  test('should show settings', async ({ page }) => {
    await page.goto('/en/settings');
    await page.screenshot({ path: 'screenshots/07-settings.png', fullPage: true });
    await expect(page.locator('h1')).toContainText('Settings');
  });
});

test.describe('Internationalization', () => {
  test('Arabic with RTL', async ({ page }) => {
    await page.goto('/ar');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');

    await page.screenshot({ path: 'screenshots/08-home-ar.png', fullPage: true });
  });

  test('Arabic dashboard', async ({ page }) => {
    await page.goto('/ar/dashboard');
    await page.screenshot({ path: 'screenshots/09-dashboard-ar.png', fullPage: true });
  });
});

test.describe('Responsive', () => {
  test('Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/en');
    await page.screenshot({ path: 'screenshots/10-mobile.png', fullPage: true });
  });

  test('Tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/en');
    await page.screenshot({ path: 'screenshots/11-tablet.png', fullPage: true });
  });

  test('Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/en');
    await page.screenshot({ path: 'screenshots/12-desktop.png', fullPage: true });
  });
});

test.describe('API', () => {
  test('health check endpoint', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.version).toBeDefined();
  });

  test('tunnels endpoint', async ({ request }) => {
    const response = await request.get('/api/tunnels');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
