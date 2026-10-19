import { test, expect } from '@playwright/test';

test('名前入力画面が表示され、エラーが出ない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#nameInput')).toBeVisible();
  expect(errors).toEqual([]);
});

test('名前がリロード後も保持される', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nameInput').fill('テスト');
  await page.locator('#nameForm').evaluate((f) => f.requestSubmit());
  await expect(page.locator('#roomStep')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('hr-name'))).toBe('テスト');
  await expect(page.locator('#roomStep')).toBeVisible();
});

test('スマホ幅で横スクロールが発生しない', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#nameInput')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
