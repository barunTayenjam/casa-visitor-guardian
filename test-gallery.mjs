import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_PORT = 5173;
const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

let browser = null;

async function testGalleryPage() {
  console.log('Starting comprehensive Puppeteer test for Gallery page...\n');

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

  const consoleMessages = [];
  const consoleErrors = [];
  const networkErrors = [];
  const jsErrors = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      consoleErrors.push(text);
      console.error(`[Console ${type.toUpperCase()}] ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    jsErrors.push(error.message);
    console.error(`[JS Error] ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    const error = request.failure();
    if (error) {
      networkErrors.push(`${request.url()}: ${error.errorText}`);
      console.error(`[Network Error] ${request.url()} - ${error.errorText}`);
    }
  });

  try {
    console.log('Step 1: Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\nStep 2: Attempting to fill login credentials...');
    
    const usernameInput = await page.$('input[type="text"], input[name="username"], input[id*="username"]');
    const passwordInput = await page.$('input[type="password"], input[name="password"], input[id*="password"]');
    
    if (usernameInput && passwordInput) {
      await usernameInput.type('admin');
      await passwordInput.type('admin123');
      console.log('Filled login form with admin/admin123');
      
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        await loginButton.click();
        console.log('Clicked login button');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } else {
      console.log('Could not find login form inputs');
    }

    console.log('\nStep 3: Checking current location...');
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    console.log('\nStep 4: Navigating to gallery page...');
    await page.goto(`${BASE_URL}/app/gallery`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const title = await page.title();
    console.log(`Page title: ${title}`);

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);

    const pageContent = await page.content();
    console.log(`Page content length: ${pageContent.length} characters`);

    const hasGalleryHeader = pageContent.includes('Detection Gallery') || pageContent.includes('Media Gallery');
    console.log(`Gallery header found: ${hasGalleryHeader}`);

    const hasErrorBoundary = pageContent.includes('Something went wrong') || pageContent.includes('Error');
    console.log(`Error boundary detected: ${hasErrorBoundary}`);

    const isNotFound = pageContent.includes('404') && pageContent.includes('Page not found');
    console.log(`Not Found page: ${isNotFound}`);

    const hasAccessDenied = pageContent.includes('Access Denied');
    console.log(`Access denied: ${hasAccessDenied}`);

    console.log('\n=== DETAILED ANALYSIS ===\n');

    console.log('Console Errors:');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('  None');
    }

    console.log('\nJS Errors:');
    if (jsErrors.length > 0) {
      jsErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('  None');
    }

    console.log('\nNetwork Errors (first 10):');
    if (networkErrors.length > 0) {
      networkErrors.slice(0, 10).forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('  None');
    }

    console.log('\n=== FINAL RESULTS ===\n');
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`JS errors: ${jsErrors.length}`);
    console.log(`Network errors: ${networkErrors.length}`);

    if (isNotFound) {
      console.log('\n⚠️  WARNING: Gallery route is not matching - showing 404 page!');
      console.log('This indicates the React Router is not matching the /app/gallery route.');
      console.log('Possible causes:');
      console.log('  1. Lazy loading of Gallery component is failing');
      console.log('  2. Authentication/ProtectedRoute is blocking access');
      console.log('  3. Route configuration issue in App.tsx');
    }

    if (hasAccessDenied) {
      console.log('\n⚠️  WARNING: Access denied - user does not have required permissions!');
    }

    if (hasErrorBoundary) {
      console.log('\n⚠️  WARNING: Error boundary triggered - component crashed during rendering!');
    }

    if (jsErrors.length > 0) {
      console.log('\n⚠️  WARNING: JavaScript errors detected - check JS Errors section above!');
    }

    if (hasGalleryHeader && !isNotFound && !hasErrorBoundary && !hasAccessDenied) {
      console.log('\n✅ Gallery page loaded successfully!');
    } else if (consoleErrors.length === 0 && jsErrors.length === 0 && networkErrors.length === 0 && !isNotFound) {
      console.log('\n✅ Gallery page structure loaded (backend may need to be running for full functionality)');
    } else {
      console.log('\n❌ Gallery page has issues that need to be addressed.');
    }

  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function cleanup() {
  console.log('\nCleaning up...');
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
  }
}

async function main() {
  try {
    await testGalleryPage();
  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main().catch(console.error);
