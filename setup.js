// Friendly setup helper, started by SETUP.bat. Connects your Telegram
// assistant, writes .env and opens the club site so you can log in.
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
async function tg(token, method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description);
  return j.result;
}
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

async function telegramStep() {
  const current = readEnv();
  if (current.TELEGRAM_BOT_TOKEN && current.TELEGRAM_CHAT_ID) {
    const keep = await ask(' Telegram is already connected. Keep it? (Y/n): ');
    if (!/^n/i.test(keep)) return;
  }

  say(
    '',
    '------------------------------------------------------------',
    ' STEP 1 of 3: Create your Telegram assistant',
    '------------------------------------------------------------',
    ' You will text this assistant to book tee times. On your phone:',
    '',
    '   1. Install Telegram (App Store / Play Store) and sign up if needed.',
    '   2. In Telegram, search for  BotFather  (blue check mark) and open it.',
    '   3. Tap START, then send:  /newbot',
    '   4. It asks for a name: send something like  Tee Time Assistant',
    '   5. It asks for a username ending in "bot": e.g.  gabriel_teetime_bot',
    '   6. It replies with a long TOKEN like  123456789:AAH...  Copy it.',
    '      (Easiest: open Telegram on this PC at web.telegram.org and copy it there.)',
    ''
  );
  openUrl('https://web.telegram.org/');

  let token = '', me = null;
  while (!me) {
    token = (await ask(' Paste the token here and press Enter: ')).replace(/\s/g, '');
    me = await tg(token, 'getMe').catch(() => null);
    if (!me) say(' That token did not work. Copy the whole thing from BotFather and try again.');
  }

  say(
    '',
    ` Found your assistant: @${me.username}`,
    ' Now open it in Telegram and tap START (or send it "hi").',
    ` Link: https://t.me/${me.username}`,
    '',
    ' Waiting for your message...'
  );
  openUrl(`https://t.me/${me.username}`);

  let chat = null;
  for (let i = 0; i < 60 && !chat; i++) {
    const updates = await tg(token, 'getUpdates', { timeout: 5 }).catch(() => []);
    const m = updates.map((u) => u.message).filter((x) => x && x.chat && x.chat.type === 'private').pop();
    if (m) chat = m.chat;
  }
  if (!chat) {
    say(' I did not see your message. Double-click SETUP again to retry.');
    throw new Error('No Telegram message received.');
  }

  writeEnv({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: String(chat.id) });
  await tg(token, 'sendMessage', { chat_id: chat.id, text: '✅ Connected! Only you can use this assistant. Finish the setup on the computer.' });
  say(` Connected to ${chat.first_name || 'you'}. Check Telegram for a "Connected" message.`);
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
  say('', ' Hi! This sets up your tee-time assistant. It only takes a few minutes.');
  await telegramStep();
  await loginStep();
  rl.close();
})().catch((e) => {
  console.error('\n Something went wrong:', e.message);
  rl.close();
  process.exitCode = 1;
});
