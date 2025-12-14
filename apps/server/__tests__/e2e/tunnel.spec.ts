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

  test('create and view tunnel', async ({ request }) => {
    // Create a tunnel
    const createResponse = await request.post('/api/tunnels', {
      data: {
        localPort: 3000,
        localHost: 'localhost',
        subdomain: `test-${Date.now()}`,
        protocol: 'HTTP',
        inspect: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createData = await createResponse.json();
    expect(createData.success).toBe(true);
    expect(createData.data.id).toBeDefined();

    // Get tunnel details
    const getResponse = await request.get(`/api/tunnels/${createData.data.id}`);
    expect(getResponse.ok()).toBeTruthy();

    const getData = await getResponse.json();
    expect(getData.success).toBe(true);
    expect(getData.data.localPort).toBe(3000);

    // Delete tunnel
    const deleteResponse = await request.delete(`/api/tunnels/${createData.data.id}`);
    expect(deleteResponse.ok()).toBeTruthy();
  });

  test('tunnel not found returns 404', async ({ request }) => {
    const response = await request.get('/api/tunnels/non-existent-id');
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('TUNNEL_NOT_FOUND');
  });
});

test.describe('Tunnel Detail Page', () => {
  test('should show tunnel detail page after creation', async ({ page, request }) => {
    // Create a tunnel first
    const createResponse = await request.post('/api/tunnels', {
      data: {
        localPort: 8080,
        localHost: 'localhost',
        subdomain: `detail-test-${Date.now()}`,
        protocol: 'HTTP',
        inspect: true,
      },
    });
    const createData = await createResponse.json();

    // Navigate to tunnel detail page
    await page.goto(`/en/tunnels/${createData.data.id}`);

    // Verify page loads
    await expect(page.locator('text=localhost:8080')).toBeVisible();

    // Clean up
    await request.delete(`/api/tunnels/${createData.data.id}`);
  });

  test('should show copy URL button', async ({ page, request }) => {
    const createResponse = await request.post('/api/tunnels', {
      data: {
        localPort: 9000,
        localHost: 'localhost',
        subdomain: `copy-test-${Date.now()}`,
        protocol: 'HTTP',
      },
    });
    const createData = await createResponse.json();

    await page.goto(`/en/tunnels/${createData.data.id}`);

    // Check for copy button
    await expect(page.locator('button:has-text("Copy")')).toBeVisible();

    // Clean up
    await request.delete(`/api/tunnels/${createData.data.id}`);
  });

  test('should handle non-existent tunnel gracefully', async ({ page }) => {
    await page.goto('/en/tunnels/non-existent-id');

    // Should show error message
    await expect(page.locator('text=not found')).toBeVisible({ timeout: 10000 });
  });

  test('should show statistics cards', async ({ page, request }) => {
    const createResponse = await request.post('/api/tunnels', {
      data: {
        localPort: 7000,
        localHost: 'localhost',
        subdomain: `stats-test-${Date.now()}`,
        protocol: 'HTTP',
      },
    });
    const createData = await createResponse.json();

    await page.goto(`/en/tunnels/${createData.data.id}`);

    // Check for stats cards
    await expect(page.locator('text=Total Requests')).toBeVisible();
    await expect(page.locator('text=Bandwidth')).toBeVisible();

    // Clean up
    await request.delete(`/api/tunnels/${createData.data.id}`);
  });
});
