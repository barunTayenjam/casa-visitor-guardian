import { expect, test } from '@playwright/test';

const BASE = 'http://192.168.31.99:9753';

async function login(page: import('@playwright/test').Page) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'tester', password: 'Correct-Horse-1!' }),
  });
  expect(res.ok).toBeTruthy();
  const auth = await res.json();
  const accessToken = auth?.data?.accessToken ?? auth?.accessToken;
  const refreshToken = auth?.data?.refreshToken ?? auth?.refreshToken;
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([token, refresh]) => {
      localStorage.setItem('auth_token', token as string);
      if (refresh) localStorage.setItem('refresh_token', refresh as string);
    },
    [accessToken, refreshToken],
  );
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

/** The camera whose tile wins the stacking order at viewport center. */
function topmostCamera(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video')).filter(
      (v) => !v.className.includes('hidden'),
    );
    const centerVideo = videos.find((v) => {
      const r = v.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null;
      if (!top) return false;
      const videoTile = v.closest('div.group');
      const topTile = top.closest('div.group');
      return videoTile != null && videoTile === topTile;
    });
    if (!centerVideo) return null;
    const tile = centerVideo.closest('div.group');
    return tile?.querySelector('p.truncate')?.textContent ?? null;
  });
}

test('focused camera renders above the other tiles', async ({ page }) => {
  await login(page);
  await page.locator('[aria-label="Focus Camera 1"]').click();
  await page.waitForTimeout(1500);
  const tiles = page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('div.group'));
    const focused = list.find((t) => t.className.includes('absolute'));
    return focused?.querySelector('p.truncate')?.textContent ?? null;
  });
  expect(await tiles).toBe('Camera 1');
  expect(await topmostCamera(page)).toBe('Camera 1');

  await page.getByRole('button', { name: 'Next camera' }).click();
  await page.waitForTimeout(1500);
  expect(await topmostCamera(page)).toBe('Camera 2');
});
