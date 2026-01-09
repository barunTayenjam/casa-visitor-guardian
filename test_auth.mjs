#!/usr/bin/env node
/**
 * Authenticated Browser Test - Login with admin credentials and test pages
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/auth_test_screenshots';
const LOG_FILE = '/tmp/auth_test_results.log';

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Test results
const results = {
  passed: [],
  failed: [],
  errors: [],
  warnings: [],
  details: {}
};

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

function recordTest(testName, passed, error = null, details = null) {
  if (passed) {
    results.passed.push(testName);
    log(`✅ ${testName}`, 'PASS');
  } else {
    results.failed.push({ testName, error, details });
    log(`❌ ${testName}: ${error}`, 'FAIL');
  }
}

async function takeScreenshot(page, filename) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  log(`Screenshot saved: ${filepath}`, 'INFO');
}

async function login(page) {
  log('=== Attempting Login ===', 'INFO');
  log(`Username: ${ADMIN_USERNAME}`, 'INFO');
  
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
  
  await takeScreenshot(page, '01_Login_Page_Before.png');
  
  try {
    // Wait for username/email input
    await page.waitForSelector('input[type="email"], input[type="text"], input[name*="email"], input[name*="username"], input[name*="user"]', { timeout: 10000 });
    
    // Fill in credentials
    await page.type('input[type="email"], input[type="text"], input[name*="email"], input[name*="username"], input[name*="user"]', ADMIN_USERNAME, { delay: 50 });
    await page.type('input[type="password"], input[name*="password"]', ADMIN_PASSWORD, { delay: 50 });
    
    await takeScreenshot(page, '02_Login_Page_Filled.png');
    
    // Click submit button - find any button on the form
    const buttonSelector = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitButton = buttons.find(btn => {
        const type = btn.getAttribute('type');
        const text = btn.textContent?.toLowerCase() || '';
        return (type === 'submit' || !type) && (text.includes('login') || text.includes('sign in'));
      });
      return submitButton ? true : false;
    });
    
    if (buttonSelector) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const submitButton = buttons.find(btn => {
            const type = btn.getAttribute('type');
            const text = btn.textContent?.toLowerCase() || '';
            return (type === 'submit' || !type) && (text.includes('login') || text.includes('sign in'));
          });
          if (submitButton) submitButton.click();
        })
      ]);
    } else {
      // Fallback: click any button
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
        page.click('button')
      ]);
    }
    
    await takeScreenshot(page, '03_After_Login.png');
    
    // Check if we're redirected to app (authenticated)
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/app') || currentUrl.includes('/dashboard');
    
    if (isLoggedIn) {
      log('✅ Login successful!', 'INFO');
      recordTest('Admin Login', true, null, { url: currentUrl });
      return true;
    } else {
      log(`❌ Login failed - Current URL: ${currentUrl}`, 'ERROR');
      recordTest('Admin Login', false, 'Not redirected to app', { url: currentUrl });
      return false;
    }
  } catch (error) {
    log(`❌ Login error: ${error.message}`, 'ERROR');
    await takeScreenshot(page, '04_Login_Error.png');
    recordTest('Admin Login', false, error.message);
    return false;
  }
}

async function checkElementExists(page, selector, testName, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    recordTest(testName, true, null, { selector });
    return true;
  } catch (error) {
    recordTest(testName, false, 'Element not found', { selector, error: error.message });
    return false;
  }
}

async function runAuthenticatedTests() {
  log('=== Starting Authenticated Browser Tests ===', 'INFO');
  log(`Base URL: ${BASE_URL}`, 'INFO');
  log(`Admin: ${ADMIN_USERNAME}`, 'INFO');
  log(`Screenshots: ${SCREENSHOT_DIR}`, 'INFO');
  log('', 'INFO');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  
  let consoleErrors = [];
  let consoleWarnings = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    } else if (msg.type() === 'warn') {
      consoleWarnings.push({ text: msg.text(), location: msg.location() });
    }
  });
  
  page.on('pageerror', error => {
    log(`Page Error: ${error.message}`, 'ERROR');
    results.errors.push({ error: error.message, stack: error.stack });
  });
  
  page.on('requestfailed', request => {
    const failure = request.failure();
    if (failure && !failure.errorText.includes('net::ERR_ABORTED')) {
      results.warnings.push({ url: request.url(), error: failure.errorText });
    }
  });
  
  try {
    // Step 1: Login
    const loginSuccess = await login(page);
    
    if (!loginSuccess) {
      log('Cannot proceed with tests - login failed', 'ERROR');
      await browser.close();
      return;
    }
    
    // Step 2: Test Gallery Page
    log('\n--- Test 2: Gallery Page (Authenticated) ---', 'INFO');
    await page.goto(`${BASE_URL}/app/gallery`, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '05_Gallery_Page.png');
    
    await checkElementExists(page, 'h1', 'Gallery Page - Has title');
    await checkElementExists(page, 'input', 'Gallery Page - Has search input');
    await checkElementExists(page, 'select', 'Gallery Page - Has filter dropdowns');
    await checkElementExists(page, 'button', 'Gallery Page - Has action buttons');
    
    // Check for grid/list view toggle
    const hasViewToggle = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => {
        const text = btn.textContent || '';
        return text.toLowerCase().includes('grid') || text.toLowerCase().includes('list');
      });
    });
    recordTest('Gallery Page - Has grid/list toggle', hasViewToggle);
    
    // Check for pagination
    const hasPagination = await page.evaluate(() => {
      return document.querySelectorAll('[class*="pagination"], [class*="Pagination"]').length > 0;
    });
    recordTest('Gallery Page - Has pagination', hasPagination);
    
    // Step 3: Test OpenCV Detection Page
    log('\n--- Test 3: OpenCV Detection Page (Authenticated) ---', 'INFO');
    await page.goto(`${BASE_URL}/app/opencv`, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '06_OpenCV_Page.png');
    
    await checkElementExists(page, 'h1, h2', 'OpenCV Page - Has title');
    await checkElementExists(page, 'select', 'OpenCV Page - Has camera select');
    await checkElementExists(page, 'button', 'OpenCV Page - Has detection buttons');
    
    // Check that old tabs are removed
    const noHistoryTab = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"], [data-radix-collection-item"], button'));
      return !tabs.some(tab => {
        const text = tab.textContent || '';
        return text.toLowerCase().includes('history') || text.toLowerCase().includes('gallery');
      });
    });
    recordTest('OpenCV Page - Old tabs removed', noHistoryTab);
    
    // Check for link to Gallery
    const hasGalleryLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.some(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent || '';
        return href.includes('/gallery') && text.toLowerCase().includes('gallery');
      });
    });
    recordTest('OpenCV Page - Has link to Gallery', hasGalleryLink);
    
    // Step 4: Test Batch Detection Page
    log('\n--- Test 4: Batch Detection Page (Authenticated) ---', 'INFO');
    await page.goto(`${BASE_URL}/app/batch-detection`, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '07_Batch_Detection_Page.png');
    
    await checkElementExists(page, 'h1, h2', 'Batch Detection - Has title');
    await checkElementExists(page, 'select', 'Batch Detection - Has date select');
    await checkElementExists(page, 'input[type="number"]', 'Batch Detection - Has limit input');
    await checkElementExists(page, 'button', 'Batch Detection - Has start button');
    
    // Step 5: Test Settings Page
    log('\n--- Test 5: Settings Page (Authenticated) ---', 'INFO');
    await page.goto(`${BASE_URL}/app/settings`, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '08_Settings_Page.png');
    
    await checkElementExists(page, 'h1', 'Settings Page - Has title');
    
    // Check that Logs tab is NOT present
    const logsTabAbsent = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[data-radix-collection-item], [role="tab"], button'));
      return !tabs.some(tab => {
        const text = tab.textContent || '';
        return text.toLowerCase().trim() === 'logs' || text.toLowerCase().includes('logs');
      });
    });
    recordTest('Settings Page - Logs tab absent (CRITICAL)', logsTabAbsent);
    
    // Check that other tabs ARE present
    const otherTabsPresent = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[data-radix-collection-item], [role="tab"], button'));
      const tabTexts = tabs.map(t => (t.textContent || '').toLowerCase()).trim();
      return tabTexts.some(t => t.includes('general')) &&
             tabTexts.some(t => t.includes('detection')) &&
             tabTexts.some(t => t.includes('storage')) &&
             tabTexts.some(t => t.includes('notification'));
    });
    recordTest('Settings Page - Other tabs present', otherTabsPresent);
    
    await checkElementExists(page, 'button[type="submit"]', 'Settings Page - Has save button');
    
    // Step 6: Test Visitor Timeline
    log('\n--- Test 6: Visitor Timeline Page (Authenticated) ---', 'INFO');
    await page.goto(`${BASE_URL}/app/visitor-timeline`, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '09_Visitor_Timeline.png');
    
    await checkElementExists(page, 'h1', 'Visitor Timeline - Has title');
    await checkElementExists(page, 'input', 'Visitor Timeline - Has filters');
    
    // Step 7: Test Old Events Route
    log('\n--- Test 7: Old Events Route Behavior ---', 'INFO');
    await page.goto(`${BASE_URL}/app/events`, { waitUntil: 'networkidle0', timeout: 30000 });
    await takeScreenshot(page, '10_Old_Events_Route.png');
    
    const currentUrl = page.url();
    const isHandled = !currentUrl.endsWith('/events') || currentUrl.includes('/gallery');
    recordTest('Old Events Route - Handled correctly', isHandled, { url: currentUrl });
    
    // Step 8: Test Navigation Links
    log('\n--- Test 8: Navigation Clicks ---', 'INFO');
    
    // Try clicking Gallery link in sidebar
    const galleryLinkExists = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const galleryLink = links.find(l => {
        const text = l.textContent || '';
        const href = l.getAttribute('href') || '';
        return text.toLowerCase().includes('gallery') && href.includes('/gallery');
      });
      if (galleryLink) {
        galleryLink.click();
        return true;
      }
      return false;
    });
    recordTest('Navigation - Gallery link clickable', galleryLinkExists);
    
    if (galleryLinkExists) {
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
      await takeScreenshot(page, '11_After_Navigating_to_Gallery.png');
    }
    
  } catch (error) {
    log(`Test suite error: ${error.message}`, 'ERROR');
    log(error.stack, 'ERROR');
  } finally {
    await browser.close();
  }
  
  // Print summary
  log('\n=== Test Summary ===', 'INFO');
  log(`Total Tests: ${results.passed.length + results.failed.length}`, 'INFO');
  log(`Passed: ${results.passed.length}`, 'INFO');
  log(`Failed: ${results.failed.length}`, 'INFO');
  log(`Console Errors: ${consoleErrors.length}`, 'INFO');
  log(`Console Warnings: ${consoleWarnings.length}`, 'INFO');
  
  if (consoleErrors.length > 0) {
    log('\nConsole Errors:', 'ERROR');
    consoleErrors.forEach(err => {
      log(`  - ${err.text}`, 'ERROR');
      if (err.location) {
        log(`    at ${err.location.url}:${err.location.lineNumber}`, 'ERROR');
      }
    });
  }
  
  if (consoleWarnings.length > 0) {
    log('\nConsole Warnings:', 'WARN');
    consoleWarnings.forEach(warn => {
      log(`  - ${warn.text}`, 'WARN');
    });
  }
  
  if (results.failed.length > 0) {
    log('\nFailed Tests:', 'ERROR');
    results.failed.forEach(f => {
      log(`  ❌ ${f.testName}`, 'ERROR');
      if (f.error) log(`    Error: ${f.error}`, 'ERROR');
      if (f.details) log(`    Details: ${JSON.stringify(f.details)}`, 'ERROR');
    });
  }
  
  // Save results
  const resultsJson = JSON.stringify({
    ...results,
    consoleErrors,
    consoleWarnings,
    timestamp: new Date().toISOString()
  }, null, 2);
  fs.writeFileSync('/tmp/auth_test_results.json', resultsJson);
  log(`\nResults saved to: /tmp/auth_test_results.json`, 'INFO');
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

runAuthenticatedTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'ERROR');
  log(error.stack, 'ERROR');
  process.exit(1);
});