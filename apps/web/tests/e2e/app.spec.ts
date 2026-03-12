import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __sceneReady?: boolean }).__sceneReady = false;
    window.addEventListener('scene:ready', () => {
      (window as Window & { __sceneReady?: boolean }).__sceneReady = true;
    });
  });
});

test('app loads and scene renders without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');
  await page.waitForFunction(() => (window as Window & { __sceneReady?: boolean }).__sceneReady === true);
  await expect(page.getByRole('heading', { name: '3D San Francisco Transit Explorer' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('user selects stops and computes route', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as Window & { __sceneReady?: boolean }).__sceneReady === true);

  await page.getByLabel('Origin').selectOption('S1');
  await page.getByLabel('Destination').selectOption('S3');
  await page.getByRole('button', { name: 'Compute Route' }).click();

  await expect(page.getByText('Stops:')).toBeVisible();
  await expect(page.getByText('Transfers:')).toBeVisible();
});

test('offline shell renders when network is blocked', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as Window & { __sceneReady?: boolean }).__sceneReady === true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '3D San Francisco Transit Explorer' })).toBeVisible();
  await context.setOffline(false);
});

test('critical asset failure triggers degraded mode', async ({ page }) => {
  await page.route('**/transit/graph*.json', async (route) => {
    await route.fulfill({ status: 500, body: 'broken graph' });
  });

  await page.goto('/');
  await expect(page.getByText('Critical transit assets failed to load.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compute Route' })).toBeDisabled();
});
