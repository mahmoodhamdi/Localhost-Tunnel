import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Screenshot base path
const SCREENSHOT_BASE = '../../docs/screenshots/authenticated';

// Generate unique test user for this test run
const TEST_USER = {
  name: 'Test User',
  email: `testuser${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

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

// ============================================================================
// SETUP: Register and Login Once
// ============================================================================
test.describe('Authenticated User Screenshots', () => {
  let authContext: BrowserContext;

  test.beforeAll(async ({ browser, request }) => {
    // Register user via API
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        name: TEST_USER.name,
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    // Accept 200, 201 (created), or 409 (already exists)
    const status = registerResponse.status();
    if (status !== 200 && status !== 201 && status !== 409) {
      console.error('Registration failed with status:', status);
    }

    // Create a new browser context for authenticated tests
    authContext = await browser.newContext();
    const page = await authContext.newPage();

    // Login via UI
    await page.goto('/en/auth/login');
    await waitForPageLoad(page);

    // Fill in login form
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect - could go to dashboard or stay on login with error
    await page.waitForTimeout(3000);

    // Check if we're logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('/auth/error')) {
      console.log('Login successful, URL:', currentUrl);
    } else {
      console.log('Login may have failed, URL:', currentUrl);
    }

    await page.close();
  });

  test.afterAll(async () => {
    if (authContext) {
      await authContext.close();
    }
  });

  // ============================================================================
  // AUTHENTICATED PAGE SCREENSHOTS
  // ============================================================================

  test('01 - Dashboard (Authenticated)', async ({ page, request }) => {
    // Register and login for this specific test
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait a bit for authentication
    await page.waitForTimeout(3000);

    // Check if redirected to dashboard or navigate there
    if (!page.url().includes('/dashboard')) {
      await page.goto('/en/dashboard');
      await waitForPageLoad(page);
    }

    await takeScreenshot(page, '01-dashboard-authenticated');
  });

  test('02 - Tunnels List (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/tunnels');
    await waitForPageLoad(page);

    await takeScreenshot(page, '02-tunnels-list-authenticated');
  });

  test('03 - Create Tunnel (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);

    await takeScreenshot(page, '03-create-tunnel-authenticated');

    // Fill form
    const portInput = page.locator('input[name="localPort"], input[id="localPort"]');
    const subdomainInput = page.locator('input[name="subdomain"], input[id="subdomain"]');

    if (await portInput.isVisible()) await portInput.fill('3000');
    if (await subdomainInput.isVisible()) await subdomainInput.fill(`myapp-${Date.now()}`);

    await takeScreenshot(page, '04-create-tunnel-filled');
  });

  test('04 - Teams (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/teams');
    await waitForPageLoad(page);

    await takeScreenshot(page, '05-teams-authenticated');
  });

  test('05 - Create Team (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/teams/new');
    await waitForPageLoad(page);

    await takeScreenshot(page, '06-create-team-authenticated');

    // Fill form if visible
    const nameInput = page.locator('input[name="name"], input[id="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('My Test Team');
      await takeScreenshot(page, '07-create-team-filled');
    }
  });

  test('06 - Settings (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/settings');
    await waitForPageLoad(page);

    await takeScreenshot(page, '08-settings-authenticated');
  });

  test('07 - API Keys (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/settings/api-keys');
    await waitForPageLoad(page);

    await takeScreenshot(page, '09-api-keys-authenticated');
  });

  test('08 - Analytics (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/analytics');
    await waitForPageLoad(page);

    await takeScreenshot(page, '10-analytics-authenticated');
  });

  test('09 - Dark Theme (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    // Force dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, '11-dashboard-dark-authenticated');
  });

  test('10 - Arabic Dashboard (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/ar/dashboard');
    await waitForPageLoad(page);

    await takeScreenshot(page, '12-dashboard-ar-authenticated');
  });

  test('11 - Mobile Dashboard (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    await takeScreenshot(page, '13-dashboard-mobile-authenticated');

    // Try to open mobile menu
    const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '14-mobile-menu-authenticated');
    }
  });

  test('12 - User Menu Header (Authenticated)', async ({ page, request }) => {
    await request.post('/api/auth/register', {
      data: { name: TEST_USER.name, email: TEST_USER.email, password: TEST_USER.password },
    });

    await page.goto('/en/auth/login');
    await waitForPageLoad(page);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    // Look for user avatar/dropdown
    const userMenu = page.locator('button:has(img), [data-testid="user-menu"], button[aria-haspopup="menu"]');
    if (await userMenu.first().isVisible()) {
      await userMenu.first().click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, '15-user-menu-open');
    } else {
      await takeScreenshot(page, '15-header-authenticated');
    }
  });
});
