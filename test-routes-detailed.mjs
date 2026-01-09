import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_PORT = 5173;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

let browser = null;

async function testRoutesDetailed() {
  console.log('Testing routes with detailed HTML analysis...\n');

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

  try {
    console.log('Login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const usernameInput = await page.$('input[type="text"]');
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
      { path: '/app', name: 'Dashboard (index)' },
      { path: '/app/opencv', name: 'OpenCV' },
      { path: '/app/gallery', name: 'Gallery' },
      { path: '/app/settings', name: 'Settings' },
    ];

    for (const route of routes) {
      console.log(`\n=== Testing: ${route.name} (${route.path}) ===`);
      
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const html = await page.content();
      
      // Check for 404
      const is404 = html.includes('"text-4xl font-bold mb-4 text-foreground">404');
      console.log(`  Is 404: ${is404}`);

      // Get visible text content (cleaner than raw HTML)
      const visibleText = await page.evaluate(() => document.body.innerText);
      
      // Check for specific content
      const checks = [
        { name: 'Dashboard', pattern: /Dashboard|Security Overview|Overview/i },
        { name: 'OpenCV', pattern: /OpenCV|Computer Vision|Detection/i },
        { name: 'Gallery', pattern: /Gallery|Detection Gallery|Events/i },
        { name: 'Settings', pattern: /Settings|General|Notifications/i },
        { name: 'Loading', pattern: /Loading...|Initializing/i },
      ];

      for (const check of checks) {
        const found = check.pattern.test(visibleText);
        console.log(`  Has ${check.name}: ${found ? '✓' : '✗'}`);
      }

      // Get the actual page structure
      const mainContent = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('[class*="container"]');
        return main ? main.innerHTML.substring(0, 500) : 'No main content found';
      });
      console.log(`  Main content preview: ${mainContent.substring(0, 100)}...`);
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
    await testRoutesDetailed();
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(console.error);
