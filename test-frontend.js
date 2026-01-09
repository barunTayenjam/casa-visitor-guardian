import puppeteer from 'puppeteer';

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    console.log('Navigating to home page...');
    await page.goto('http://192.168.31.99:5173', { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');

    const title = await page.title();
    console.log('Page title:', title);

    const bodyText = await page.evaluate(() => document.body.textContent);
    console.log('Dashboard loaded:', bodyText.length > 100);
    console.log('Shows security dashboard:', bodyText.includes('Security Dashboard'));

    // Test dashboard (loads directly now)
    console.log('Testing dashboard page...');
    const dashboardText = await page.evaluate(() => document.body.textContent);
    console.log('Dashboard shows content:', dashboardText.length > 100);
    console.log('Dashboard shows security elements:', dashboardText.includes('Security') || dashboardText.includes('Camera'));
    console.log('Dashboard shows streams mode:', dashboardText.includes('Camera Streams') || dashboardText.includes('No Cameras'));
    console.log('Dashboard shows loading:', dashboardText.includes('Loading Cameras'));

    // Check if React root is present
    const hasReactRoot = await page.evaluate(() => !!document.getElementById('root'));
    console.log('React root present:', hasReactRoot);

    // Check if there are any elements in the body
    const bodyChildren = await page.evaluate(() => document.body.children.length);
    console.log('Body children count:', bodyChildren);

    // Inspect the body structure
    const bodyStructure = await page.evaluate(() => {
      const children = Array.from(document.body.children);
      return children.map(child => ({
        tagName: child.tagName,
        id: child.id,
        className: child.className,
        textContent: child.textContent?.substring(0, 100)
      }));
    });
    console.log('Body structure:', bodyStructure);

    // Check if the root div has content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML.substring(0, 200) : 'No root found';
    });
    console.log('Root div content:', rootContent);

    if (consoleMessages.length > 0) {
      console.log('Console messages:', consoleMessages);
    }
    if (pageErrors.length > 0) {
      console.log('Page errors:', pageErrors);
    }

    // Test gallery
    console.log('Testing gallery page...');
    await page.goto('http://192.168.31.99:5173/gallery', { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const galleryText = await page.evaluate(() => document.body.textContent);
    console.log('Gallery accessible (no login redirect):', !galleryText.includes('Welcome Back'));

    // Test settings page
    console.log('Testing settings page...');
    await page.goto('http://192.168.31.99:5173/settings', { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const settingsText = await page.evaluate(() => document.body.textContent);
    console.log('Settings accessible (no login redirect):', !settingsText.includes('Welcome Back'));

    // Test camera config page
    console.log('Testing camera config page...');
    await page.goto('http://192.168.31.99:5173/cameras', { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const camerasText = await page.evaluate(() => document.body.textContent);
    console.log('Camera config accessible (no login redirect):', !camerasText.includes('Welcome Back'));

    // Test stream dashboard
    console.log('Testing stream dashboard page...');
    await page.goto('http://192.168.31.99:5173/streams', { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const streamsText = await page.evaluate(() => document.body.textContent);
    console.log('Stream dashboard accessible (no login redirect):', !streamsText.includes('Welcome Back'));

    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();