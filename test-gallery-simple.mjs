import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_PORT = 5173;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

let browser = null;

async function testGallerySimple() {
  console.log('Simple Gallery Test...\n');

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
      console.log(`[Console ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    console.log(`[Page Error] ${error.message}`);
  });

  try {
    console.log('1. Login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const usernameInput = await page.$('input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (usernameInput && passwordInput) {
      await usernameInput.type('admin');
      await passwordInput.type('admin123');
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    console.log('2. Go to Dashboard (/app)...');
    await page.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    let content = await page.content();
    console.log('   Dashboard 404:', content.includes('404') && content.includes('Page not found'));

    console.log('3. Go to Gallery (/app/gallery)...');
    await page.goto(`${BASE_URL}/app/gallery`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    content = await page.content();
    console.log('   Gallery 404:', content.includes('404') && content.includes('Page not found'));
    console.log('   Gallery has content:', content.length > 50000);
    console.log('   Gallery has Detection Gallery:', content.includes('Detection Gallery'));
    console.log('   Gallery has ErrorBoundary:', content.includes('Something went wrong'));

    console.log('\n4. Get page HTML preview...');
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log('   Body HTML:', bodyHTML.substring(0, 200) + '...');

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
    await testGallerySimple();
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(console.error);
