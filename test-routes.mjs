import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_PORT = 5173;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

let browser = null;

async function testRoutes() {
  console.log('Testing multiple routes to identify the issue...\n');

  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('config.js')) {
      console.error(`[Console] ${msg.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    console.error(`[JS Error] ${error.message}`);
  });

  try {
    console.log('Step 1: Login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const usernameInput = await page.$('input[type="text"], input[name="username"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (usernameInput && passwordInput) {
      await usernameInput.type('admin');
      await passwordInput.type('admin123');
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const routes = [
      '/app',
      '/app/dashboard',
      '/app/gallery',
      '/app/opencv',
      '/app/settings',
      '/app/camera-config',
    ];

    for (const route of routes) {
      console.log(`\nTesting route: ${route}`);
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pageContent = await page.content();
      const has404 = pageContent.includes('404') && pageContent.includes('Page not found');
      const hasGalleryHeader = pageContent.includes('Detection Gallery') || pageContent.includes('Media Gallery');
      const hasDashboard = pageContent.includes('Dashboard') || pageContent.includes('Security Overview');
      const hasOpenCV = pageContent.includes('OpenCV') || pageContent.includes('Computer Vision');

      console.log(`  URL: ${page.url()}`);
      console.log(`  404 Page: ${has404}`);
      console.log(`  Has expected content: ${hasGalleryHeader || hasDashboard || hasOpenCV || route === '/app'}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  try {
    await testRoutes();
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(console.error);
