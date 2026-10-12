// One-time (or whenever the session expires): opens the club site in the bot's
// own browser profile so YOU can log in. The bot reuses this saved session,
// so your password is never stored in any file.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'browser-profile'), {
    headless: false,
    viewport: null,
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://countryclub.golfmanager.com/consumer/home');
  console.log('\nLog in to your Country Club account in the window that opened.');
  console.log('When you see "Hola GABRIEL..." at the top, just close the window.\n');
  await new Promise((resolve) => ctx.on('close', resolve));
  console.log('Session saved. You can now run: npm run dry-run');
})();
