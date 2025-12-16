import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Screenshot base path
const SCREENSHOT_BASE = '../../docs/screenshots';

// Helper function to take screenshot with consistent naming
async function takeScreenshot(page: Page, category: string, name: string, fullPage = true) {
  const screenshotPath = path.join(SCREENSHOT_BASE, category, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage });
}

// Helper to wait for page load
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait a bit for animations
  await page.waitForTimeout(500);
}

// ============================================================================
// HOME PAGE TESTS
// ============================================================================
test.describe('Home Page', () => {
  test('English home page', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    await expect(page.locator('h1')).toBeVisible();
    await takeScreenshot(page, 'en', '01-home');
  });

  test('Arabic home page with RTL', async ({ page }) => {
    await page.goto('/ar');
    await waitForPageLoad(page);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');

    await takeScreenshot(page, 'ar', '01-home-ar');
  });
});

// ============================================================================
// AUTHENTICATION PAGES
// ============================================================================
test.describe('Authentication Pages', () => {
  test('Login page', async ({ page }) => {
    await page.goto('/en/auth/login');
    await waitForPageLoad(page);

    await expect(page.locator('form')).toBeVisible();
    await takeScreenshot(page, 'auth', '01-login');
  });

  test('Login page - Arabic', async ({ page }) => {
    await page.goto('/ar/auth/login');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'auth', '02-login-ar');
  });

  test('Register page', async ({ page }) => {
    await page.goto('/en/auth/register');
    await waitForPageLoad(page);

    await expect(page.locator('form')).toBeVisible();
    await takeScreenshot(page, 'auth', '03-register');
  });

  test('Register page - Arabic', async ({ page }) => {
    await page.goto('/ar/auth/register');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'auth', '04-register-ar');
  });

  test('Forgot password page', async ({ page }) => {
    await page.goto('/en/auth/forgot-password');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'auth', '05-forgot-password');
  });

  test('Auth error page', async ({ page }) => {
    await page.goto('/en/auth/error?error=AccessDenied');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'auth', '06-auth-error');
  });

  test('Login with validation errors', async ({ page }) => {
    await page.goto('/en/auth/login');
    await waitForPageLoad(page);

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'auth', '07-login-validation');
    }
  });

  test('Register with validation errors', async ({ page }) => {
    await page.goto('/en/auth/register');
    await waitForPageLoad(page);

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);
      await takeScreenshot(page, 'auth', '08-register-validation');
    }
  });
});

// ============================================================================
// DASHBOARD
// ============================================================================
test.describe('Dashboard', () => {
  test('Dashboard page - English', async ({ page }) => {
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    await expect(page.locator('h1')).toContainText(/Dashboard|لوحة/i);
    await takeScreenshot(page, 'en', '02-dashboard');
  });

  test('Dashboard page - Arabic', async ({ page }) => {
    await page.goto('/ar/dashboard');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '02-dashboard-ar');
  });
});

// ============================================================================
// TUNNELS
// ============================================================================
test.describe('Tunnels', () => {
  test('Tunnels list page', async ({ page }) => {
    await page.goto('/en/tunnels');
    await waitForPageLoad(page);

    await expect(page.locator('h1')).toBeVisible();
    await takeScreenshot(page, 'en', '03-tunnels-list');
  });

  test('Tunnels list page - Arabic', async ({ page }) => {
    await page.goto('/ar/tunnels');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '03-tunnels-list-ar');
  });

  test('Create tunnel form', async ({ page }) => {
    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '04-create-tunnel');
  });

  test('Create tunnel form - Arabic', async ({ page }) => {
    await page.goto('/ar/tunnels/new');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '04-create-tunnel-ar');
  });

  test('Create tunnel form - filled', async ({ page }) => {
    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);

    // Fill in the form
    const portInput = page.locator('[data-testid="port-input"], input[name="port"], #port');
    const subdomainInput = page.locator('[data-testid="subdomain-input"], input[name="subdomain"], #subdomain');

    if (await portInput.isVisible()) {
      await portInput.fill('3000');
    }
    if (await subdomainInput.isVisible()) {
      await subdomainInput.fill('my-app');
    }

    await takeScreenshot(page, 'en', '05-create-tunnel-filled');
  });

  test('Tunnel detail page', async ({ page }) => {
    await page.goto('/en/tunnels/example-tunnel-id');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '06-tunnel-detail');
  });

  test('Tunnel inspector page', async ({ page }) => {
    await page.goto('/en/tunnels/example-tunnel-id/inspector');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '07-tunnel-inspector');
  });
});

// ============================================================================
// TEAMS
// ============================================================================
test.describe('Teams', () => {
  test('Teams list page', async ({ page }) => {
    await page.goto('/en/teams');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '08-teams-list');
  });

  test('Teams list page - Arabic', async ({ page }) => {
    await page.goto('/ar/teams');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '08-teams-list-ar');
  });

  test('Create team page', async ({ page }) => {
    await page.goto('/en/teams/new');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '09-create-team');
  });

  test('Team detail page', async ({ page }) => {
    await page.goto('/en/teams/example-team-id');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '10-team-detail');
  });

  test('Team members page', async ({ page }) => {
    await page.goto('/en/teams/example-team-id/members');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '11-team-members');
  });

  test('Team settings page', async ({ page }) => {
    await page.goto('/en/teams/example-team-id/settings');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '12-team-settings');
  });
});

// ============================================================================
// SETTINGS
// ============================================================================
test.describe('Settings', () => {
  test('Settings page - English', async ({ page }) => {
    await page.goto('/en/settings');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '13-settings');
  });

  test('Settings page - Arabic', async ({ page }) => {
    await page.goto('/ar/settings');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '13-settings-ar');
  });

  test('API Keys page', async ({ page }) => {
    await page.goto('/en/settings/api-keys');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '14-api-keys');
  });

  test('API Keys page - Arabic', async ({ page }) => {
    await page.goto('/ar/settings/api-keys');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '14-api-keys-ar');
  });
});

// ============================================================================
// ANALYTICS
// ============================================================================
test.describe('Analytics', () => {
  test('Analytics page - English', async ({ page }) => {
    await page.goto('/en/analytics');
    await waitForPageLoad(page);

    await expect(page.locator('h1')).toBeVisible();
    await takeScreenshot(page, 'en', '15-analytics');
  });

  test('Analytics page - Arabic', async ({ page }) => {
    await page.goto('/ar/analytics');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '15-analytics-ar');
  });
});

// ============================================================================
// DOCUMENTATION
// ============================================================================
test.describe('Documentation', () => {
  test('Docs page - English', async ({ page }) => {
    await page.goto('/en/docs');
    await waitForPageLoad(page);

    await expect(page.locator('h1')).toBeVisible();
    await takeScreenshot(page, 'en', '16-docs');
  });

  test('Docs page - Arabic', async ({ page }) => {
    await page.goto('/ar/docs');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '16-docs-ar');
  });

  test('API Docs page - English', async ({ page }) => {
    await page.goto('/en/api-docs');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '17-api-docs');
  });

  test('API Docs page - Arabic', async ({ page }) => {
    await page.goto('/ar/api-docs');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'ar', '17-api-docs-ar');
  });
});

// ============================================================================
// RESPONSIVE DESIGN
// ============================================================================
test.describe('Responsive Design', () => {
  test('Mobile - Home', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '01-mobile-home');
  });

  test('Mobile - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '02-mobile-dashboard');
  });

  test('Mobile - Tunnels', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en/tunnels');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '03-mobile-tunnels');
  });

  test('Mobile - Menu open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/en');
    await waitForPageLoad(page);

    // Try to open mobile menu
    const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], [data-testid="mobile-menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
    }

    await takeScreenshot(page, 'responsive', '04-mobile-menu');
  });

  test('Tablet - Home', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/en');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '05-tablet-home');
  });

  test('Tablet - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '06-tablet-dashboard');
  });

  test('Desktop - Home', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/en');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '07-desktop-home');
  });

  test('Desktop - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'responsive', '08-desktop-dashboard');
  });
});

// ============================================================================
// THEME TESTS
// ============================================================================
test.describe('Themes', () => {
  test('Light theme - Home', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Force light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '01-light-home');
  });

  test('Dark theme - Home', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Force dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '02-dark-home');
  });

  test('Light theme - Dashboard', async ({ page }) => {
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    // Force light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '03-light-dashboard');
  });

  test('Dark theme - Dashboard', async ({ page }) => {
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    // Force dark theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '04-dark-dashboard');
  });

  test('Light theme - Tunnels', async ({ page }) => {
    await page.goto('/en/tunnels');
    await waitForPageLoad(page);

    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '05-light-tunnels');
  });

  test('Dark theme - Tunnels', async ({ page }) => {
    await page.goto('/en/tunnels');
    await waitForPageLoad(page);

    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '06-dark-tunnels');
  });

  test('Light theme - Create Tunnel', async ({ page }) => {
    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);

    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '07-light-create-tunnel');
  });

  test('Dark theme - Create Tunnel', async ({ page }) => {
    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);

    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'themes', '08-dark-create-tunnel');
  });
});

// ============================================================================
// API TESTS
// ============================================================================
test.describe('API Endpoints', () => {
  test('Health check endpoint', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('HEALTHY');
  });

  test('Tunnels endpoint requires auth', async ({ request }) => {
    const response = await request.get('/api/tunnels');
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('Dashboard stats endpoint', async ({ request }) => {
    const response = await request.get('/api/dashboard/stats');
    // May require auth
    expect([200, 401]).toContain(response.status());
  });

  test('Settings endpoint requires auth', async ({ request }) => {
    const response = await request.get('/api/settings');
    expect(response.status()).toBe(401);
  });

  test('Teams endpoint requires auth', async ({ request }) => {
    const response = await request.get('/api/teams');
    expect(response.status()).toBe(401);
  });

  test('API Keys endpoint requires auth', async ({ request }) => {
    const response = await request.get('/api/keys');
    expect(response.status()).toBe(401);
  });

  test('Analytics endpoint', async ({ request }) => {
    const response = await request.get('/api/analytics');
    // May require auth or return public data
    expect([200, 401]).toContain(response.status());
  });
});

// ============================================================================
// ERROR STATES
// ============================================================================
test.describe('Error States', () => {
  test('404 page - Non-existent route', async ({ page }) => {
    await page.goto('/en/this-page-does-not-exist');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '18-404-error');
  });

  test('Non-existent tunnel', async ({ page }) => {
    await page.goto('/en/tunnels/non-existent-tunnel-id-12345');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '19-tunnel-not-found');
  });

  test('Non-existent team', async ({ page }) => {
    await page.goto('/en/teams/non-existent-team-id-12345');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '20-team-not-found');
  });
});

// ============================================================================
// INVITATION PAGE
// ============================================================================
test.describe('Invitations', () => {
  test('Invitation page with invalid token', async ({ page }) => {
    await page.goto('/en/invitations/invalid-token');
    await waitForPageLoad(page);

    await takeScreenshot(page, 'en', '21-invitation-invalid');
  });
});

// ============================================================================
// NAVIGATION TESTS
// ============================================================================
test.describe('Navigation', () => {
  test('Navigate from home to dashboard', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Click on dashboard link
    const dashboardLink = page.locator('a[href*="/dashboard"]').first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await waitForPageLoad(page);
      await expect(page.url()).toContain('/dashboard');
    }
  });

  test('Navigate from dashboard to tunnels', async ({ page }) => {
    await page.goto('/en/dashboard');
    await waitForPageLoad(page);

    // Click on tunnels link
    const tunnelsLink = page.locator('a[href*="/tunnels"]').first();
    if (await tunnelsLink.isVisible()) {
      await tunnelsLink.click();
      await waitForPageLoad(page);
      await expect(page.url()).toContain('/tunnels');
    }
  });

  test('Language switcher - EN to AR', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Find language switcher
    const langSwitcher = page.locator('a[href*="/ar"], button:has-text("العربية"), [data-testid="language-switcher"]');
    if (await langSwitcher.first().isVisible()) {
      await langSwitcher.first().click();
      await waitForPageLoad(page);

      const html = page.locator('html');
      await expect(html).toHaveAttribute('dir', 'rtl');
    }
  });

  test('Theme toggle', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Find theme toggle
    const themeToggle = page.locator('button[aria-label*="theme"], button[aria-label*="Theme"], [data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));

      await themeToggle.click();
      await page.waitForTimeout(500);

      // Check if theme changed
      const newTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(newTheme).not.toBe(initialTheme);
    }
  });
});

// ============================================================================
// FORM INTERACTIONS
// ============================================================================
test.describe('Form Interactions', () => {
  test('Create tunnel form - all fields', async ({ page }) => {
    await page.goto('/en/tunnels/new');
    await waitForPageLoad(page);

    // Try to fill all form fields
    const portInput = page.locator('input[name="port"], input[id="port"], [data-testid="port-input"]');
    const subdomainInput = page.locator('input[name="subdomain"], input[id="subdomain"], [data-testid="subdomain-input"]');
    const passwordInput = page.locator('input[name="password"], input[id="password"], [data-testid="password-input"]');

    if (await portInput.isVisible()) await portInput.fill('8080');
    if (await subdomainInput.isVisible()) await subdomainInput.fill('my-custom-app');
    if (await passwordInput.isVisible()) await passwordInput.fill('secret123');

    await takeScreenshot(page, 'en', '22-create-tunnel-all-fields');
  });

  test('Settings form interactions', async ({ page }) => {
    await page.goto('/en/settings');
    await waitForPageLoad(page);

    // Interact with text form elements if visible (not number inputs)
    const textInputs = page.locator('input[type="text"]:visible, input[type="email"]:visible');
    const inputCount = await textInputs.count();

    if (inputCount > 0) {
      // Fill first visible text input
      await textInputs.first().fill('test-value');
    }

    await takeScreenshot(page, 'en', '23-settings-interaction');
  });
});

// ============================================================================
// ACCESSIBILITY
// ============================================================================
test.describe('Accessibility', () => {
  test('Focus states visible', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await takeScreenshot(page, 'en', '24-focus-states');
  });

  test('Keyboard navigation', async ({ page }) => {
    await page.goto('/en');
    await waitForPageLoad(page);

    // Use keyboard to navigate
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await waitForPageLoad(page);
    await takeScreenshot(page, 'en', '25-keyboard-navigation');
  });
});
