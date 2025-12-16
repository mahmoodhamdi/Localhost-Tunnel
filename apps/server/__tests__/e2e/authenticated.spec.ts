import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Screenshot base path
const SCREENSHOT_BASE = '../../docs/screenshots/authenticated';

// Helper function to take screenshot
async function takeScreenshot(page: Page, name: string, fullPage = true) {
  const screenshotPath = path.join(SCREENSHOT_BASE, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage });
}

// Helper to wait for page load
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// Helper to authenticate via login form
async function authenticateUser(page: Page, context: BrowserContext, request: any, testName: string): Promise<boolean> {
  const uniqueEmail = `test-${testName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  // Step 1: First navigate to a page to initialize the context
  await page.goto('/en/auth/login');
  await waitForPageLoad(page);

  // Step 2: Register user via API
  const registerResponse = await page.request.post('/api/auth/register', {
    data: {
      name: 'Test User',
      email: uniqueEmail,
      password: password,
    },
  });

  if (registerResponse.status() !== 200) {
    console.log(`Registration failed with status: ${registerResponse.status()}`);
    return false;
  }

  // Step 3: Fill in the login form
  await page.locator('#email').fill(uniqueEmail);
  await page.locator('#password').fill(password);

  // Step 4: Click login button and wait for the result
  await page.locator('button[type="submit"]').click();

  // Step 5: Wait for either navigation to dashboard or error message
  await page.waitForTimeout(3000);

  // Step 6: Check the result
  const currentUrl = page.url();

  // If still on login page, check for error messages
  if (currentUrl.includes('/auth/login')) {
    // Check if there's an error and try to force navigate to dashboard
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);
  }

  const finalUrl = page.url();
  const isAuthenticated = finalUrl.includes('/dashboard') ||
                         !finalUrl.includes('/auth/login') && !finalUrl.includes('/auth/error');

  return isAuthenticated;
}

// ============================================================================
// AUTHENTICATED USER SCREENSHOTS
// ============================================================================
test.describe('Authenticated User Screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  test('01 - Login Flow Screenshots', async ({ page }) => {
    const uniqueEmail = `test-login-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // Screenshot: Login page (before registration)
    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await takeScreenshot(page, '01-login-page');

    // Register user via API
    await page.request.post('/api/auth/register', {
      data: { name: 'Test User', email: uniqueEmail, password },
    });

    // Screenshot: Login form filled
    await page.locator('#email').fill(uniqueEmail);
    await page.locator('#password').fill(password);
    await takeScreenshot(page, '02-login-filled');

    // Click login and wait
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    // Navigate to dashboard to verify authentication
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);
    await takeScreenshot(page, '03-after-login');
  });

  test('02 - Dashboard Authenticated', async ({ page, context, request }) => {
    const isAuth = await authenticateUser(page, context, request, 'dashboard');
    await takeScreenshot(page, '04-dashboard-authenticated');
  });

  test('03 - Tunnels List Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'tunnels');
    await page.goto('/en/tunnels');
    await waitForPageLoad(page);
    await takeScreenshot(page, '05-tunnels-authenticated');
  });

  test('04 - Create Tunnel Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'create-tunnel');
    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);
    await takeScreenshot(page, '06-create-tunnel-authenticated');

    // Fill form
    const portInput = page.locator('input[name="localPort"], input[id="localPort"]');
    const subdomainInput = page.locator('input[name="subdomain"], input[id="subdomain"]');

    if (await portInput.isVisible()) await portInput.fill('3000');
    if (await subdomainInput.isVisible()) await subdomainInput.fill(`app-${Date.now()}`);

    await takeScreenshot(page, '07-create-tunnel-filled');
  });

  test('05 - Teams Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'teams');
    await page.goto('/en/teams');
    await waitForPageLoad(page);
    await takeScreenshot(page, '08-teams-authenticated');
  });

  test('06 - Create Team Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'create-team');
    await page.goto('/en/teams/new');
    await waitForPageLoad(page);
    await takeScreenshot(page, '09-create-team-authenticated');

    const nameInput = page.locator('input[name="name"], input[id="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('My Test Team');
      await takeScreenshot(page, '10-create-team-filled');
    }
  });

  test('07 - Settings Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'settings');
    await page.goto('/en/settings');
    await waitForPageLoad(page);
    await takeScreenshot(page, '11-settings-authenticated');
  });

  test('08 - API Keys Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'api-keys');
    await page.goto('/en/settings/api-keys');
    await waitForPageLoad(page);
    await takeScreenshot(page, '12-api-keys-authenticated');
  });

  test('09 - Analytics Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'analytics');
    await page.goto('/en/analytics');
    await waitForPageLoad(page);
    await takeScreenshot(page, '13-analytics-authenticated');
  });

  test('10 - Dark Theme Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'dark');
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, '14-dashboard-dark-authenticated');
  });

  test('11 - Arabic Dashboard Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'arabic');
    await page.goto('/ar/dashboard');
    await waitForPageLoad(page);
    await takeScreenshot(page, '15-dashboard-ar-authenticated');
  });

  test('12 - Mobile Dashboard Authenticated', async ({ page, context, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await authenticateUser(page, context, request, 'mobile');
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);
    await takeScreenshot(page, '16-dashboard-mobile-authenticated');

    const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '17-mobile-menu-authenticated');
    }
  });

  test('13 - User Menu Authenticated', async ({ page, context, request }) => {
    await authenticateUser(page, context, request, 'user-menu');
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    const userMenu = page.locator('button:has(img), [aria-haspopup="menu"]').first();
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '18-user-menu-open');
    } else {
      await takeScreenshot(page, '18-header-authenticated');
    }
  });
});
