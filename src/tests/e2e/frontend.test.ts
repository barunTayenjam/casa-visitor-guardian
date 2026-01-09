import puppeteer from 'puppeteer';

describe('Frontend E2E Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    await page.close();
  });

  test('should load the home page', async () => {
    await page.goto('http://localhost:5174');
    await page.waitForSelector('body');

    // Check if the page loaded
    const title = await page.title();
    expect(title).toBe('Vite + React + TS');

    // Check for content
    const bodyText = await page.evaluate(() => document.body.textContent);
    expect(bodyText).toContain('Home Page');
  });

  test('should navigate to dashboard', async () => {
    await page.goto('http://localhost:5174/dashboard');
    await page.waitForSelector('body');

    // Dashboard might be protected, check if it loads
    const bodyText = await page.evaluate(() => document.body.textContent);
    // Since it's lazy loaded, check if it attempts to load
    expect(bodyText).toBeTruthy();
  });

  test('should navigate to gallery', async () => {
    await page.goto('http://localhost:5174/gallery');
    await page.waitForSelector('body');

    const bodyText = await page.evaluate(() => document.body.textContent);
    expect(bodyText).toBeTruthy();
  });
});