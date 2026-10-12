// Friendly setup helper, started by SETUP.bat. Asks for the WhatsApp details,
// writes .env, opens the club site so you can log in, and sends a test message.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync, exec } = require('child_process');

const dir = __dirname;
const envPath = path.join(dir, '.env');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const queued = [];
const waiting = [];
rl.on('line', (l) => (waiting.length ? waiting.shift()(l.trim()) : queued.push(l.trim())));
const ask = (q) => {
  process.stdout.write(q);
  return queued.length ? Promise.resolve(queued.shift()) : new Promise((r) => waiting.push(r));
};
const say = (...lines) => console.log(lines.join('\n'));
const openUrl = (url) => {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
};
const runNode = (...args) => spawnSync(process.execPath, args, { cwd: dir, stdio: 'inherit' });

function readEnv() {
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)])
  );
}

function writeEnv(values) {
  const base = fs.existsSync(envPath) ? envPath : path.join(dir, '.env.example');
  const lines = fs.readFileSync(base, 'utf8').split(/\r?\n/);
  for (const [k, v] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(envPath, lines.join('\n'));
}

async function whatsappStep() {
  const current = readEnv();
  if (current.WHATSAPP_PHONE && current.CALLMEBOT_APIKEY) {
    const keep = await ask(`WhatsApp is already set up for ${current.WHATSAPP_PHONE}. Keep it? (Y/n): `);
    if (!/^n/i.test(keep)) return;
  }

  say(
    '',
    '------------------------------------------------------------',
    ' STEP 1 of 3: WhatsApp alerts',
    '------------------------------------------------------------',
    ' The bot texts you on WhatsApp when it books (or if something goes wrong).',
    ' It uses a free service called CallMeBot. I am opening their page now.',
    '',
    '   1. On that page, find the phone number they tell you to save.',
    '   2. Save it in your phone contacts (any name, e.g. "CallMeBot").',
    '   3. In WhatsApp, send that contact the exact message shown on the page',
    '      (it looks like: I allow callmebot to send me messages).',
    '   4. Within a minute or two they reply with your "apikey" (a number).',
    ''
  );
  openUrl('https://www.callmebot.com/blog/free-api-whatsapp-messages/');

  let phone = '';
  while (phone.length < 8) {
    phone = (await ask(' Your WhatsApp number WITH country code (e.g. 1 809 555 1234): ')).replace(/\D/g, '');
    if (phone.length < 8) say(' That looks too short. Please include the country code.');
  }
  let key = '';
  while (!key) key = (await ask(' The apikey CallMeBot sent you: ')).replace(/\s/g, '');

  writeEnv({ WHATSAPP_PHONE: phone, CALLMEBOT_APIKEY: key });
  say('', ' Sending you a test WhatsApp message...');
  runNode('bot.js', '--test-alert');
  const got = await ask(' Did you get the test message on WhatsApp? (Y/n): ');
  if (/^n/i.test(got)) {
    say(
      '',
      ' No problem. Usually the apikey or number has a typo.',
      ' Just double-click SETUP again later and re-enter them.',
      ' (The bot still books without WhatsApp, you just will not get alerts.)'
    );
  } else {
    say(' Great, alerts are working.');
  }
}

async function loginStep() {
  say(
    '',
    '------------------------------------------------------------',
    ' STEP 2 of 3: Log in to the Country Club website',
    '------------------------------------------------------------',
    ' A browser window will open on the Country Club site.',
    ' Log in like you normally do. When you see "Hola GABRIEL" at the top,',
    ' just CLOSE that browser window and come back here.',
    ''
  );
  await ask(' Press Enter to open the website... ');
  runNode('login.js');
}

(async () => {
  say('', ' Hi! This sets up your tee-time bot. It only takes a few minutes.');
  await whatsappStep();
  await loginStep();
  rl.close();
})().catch((e) => {
  console.error('\n Something went wrong:', e.message);
  rl.close();
  process.exitCode = 1;
});
