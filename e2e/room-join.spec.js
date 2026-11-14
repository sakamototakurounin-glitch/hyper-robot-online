import { test, expect } from '@playwright/test';

// ローカル D1（wrangler dev --local）だけを使う。本番には接続しない。
async function enterName(page, name) {
  await page.goto('/');
  await page.locator('#nameInput').fill(name);
  await page.locator('#nameForm').evaluate((f) => f.requestSubmit());
  await expect(page.locator('#roomStep')).toBeVisible();
}

test('入力のしかたが違っても同じルームに参加でき、見つからないときはルーム名を示す', async ({ browser }, testInfo) => {
  const suffix = `${testInfo.project.name}${Date.now() % 100000}`;
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  await enterName(host, 'ホスト');
  await host.locator('#showCreate').click();
  await host.locator('#roomInput').fill(`テスト ルーム-${suffix}`);
  await host.locator('#roomForm').evaluate((f) => f.requestSubmit());
  await expect(host.locator('#game')).toBeVisible();

  await enterName(guest, 'ゲスト');
  await guest.locator('#showJoin').click();
  // 違うルーム名ならエラーに入力した名前を出す
  await guest.locator('#joinRoomInput').fill('存在しないルーム');
  await guest.locator('#joinRoomForm').evaluate((f) => f.requestSubmit());
  await expect(guest.locator('#setupError')).toContainText('「存在しないルーム」が見つかりません');
  // 空白なし・ひらがな・全角の伸ばし棒でも同じルームとして参加できる
  await guest.locator('#joinRoomInput').fill(`てすとるーむー${suffix}`);
  await guest.locator('#joinRoomForm').evaluate((f) => f.requestSubmit());
  await expect(guest.locator('#game')).toBeVisible();
  await host.context().close(); await guest.context().close();
});
