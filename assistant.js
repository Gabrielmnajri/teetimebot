// Telegram tee-time assistant. Text it "book saturday 8:30" and it schedules
// the booking: the evening before booking opens it checks you're still logged
// in, and at opening time (the day before, 8:00 AM) it runs bot.js to grab
// the slot. If that day is already open, it books right away.
//
// Keep this running on an always-on computer (SETUP starts it at login).

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parse, ymd } = require('./parse');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = String(process.env.TELEGRAM_CHAT_ID || '');
const OPEN_TIME = process.env.OPEN_TIME || '08:00';
const OPEN_DAYS_BEFORE = Number(process.env.OPEN_DAYS_BEFORE || 1);
const START_EARLY_MS = 3 * 60 * 1000; // start the browser 3 min before opening
const CHECK_BEFORE_MS = 12 * 60 * 60 * 1000; // login check the evening before
const STATE = path.join(__dirname, 'assistant-state.json');

const log = (...m) => console.log(new Date().toLocaleString('en-US', { hour12: false }), ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TOKEN || !CHAT) {
  console.error('Telegram is not set up yet. Double-click SETUP first.');
  process.exit(1);
}

// ---------- saved state (survives restarts) ----------
let state = { offset: 0, nextNumber: 1, jobs: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch {}
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
const active = () => state.jobs.filter((j) => ['scheduled', 'running'].includes(j.status)).sort((a, b) => a.date.localeCompare(b.date));

// ---------- formatting ----------
const dayName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const time12 = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const when = (ms) => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const courseName = (c) => (c === '2' ? 'Los Robles' : 'Campo Senior');
const describe = (j) =>
  `${dayName(j.date)} at ${time12(j.times[0])}` +
  (j.times.length > 1 ? ` (backups: ${j.times.slice(1).map(time12).join(', ')})` : '') +
  `\n${courseName(j.course)}, ${/09H/.test(j.rate) ? '9' : '18'} holes\nPlayers: ${j.players.join(', ')}`;

function openingTime(date) {
  const d = new Date(`${date}T${OPEN_TIME}:00`);
  d.setDate(d.getDate() - OPEN_DAYS_BEFORE);
  return d.getTime();
}

// ---------- Telegram ----------
async function tg(method, body) {
  const r = await fetch(`${process.env.TELEGRAM_API || 'https://api.telegram.org'}/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.description || 'Telegram error');
  return j.result;
}
const reply = (text) => tg('sendMessage', { chat_id: CHAT, text }).catch((e) => log('send failed:', e.message));

const HELP = [
  'Hi! I book tee times for you. Just text me, for example:',
  '',
  '• book saturday 8:30',
  '• book saturday 8:30 or 9:00 with 4299-1, 4299, 4299-c',
  '• book oct 24 10am only   (no backup times)',
  '• book sunday 7:30 los robles 9 holes',
  '• list   (see what I have scheduled)',
  '• cancel saturday   or   cancel 1',
  '',
  'If booking for that day has not opened yet, I wait and grab it the moment it opens (the day before at 8:00 AM).',
].join('\n');

// ---------- handling messages ----------
async function handle(text) {
  const now = new Date();
  const req = parse(text, now);
  log('message:', JSON.stringify(text), '->', req.action);

  if (req.action === 'help') return reply(HELP);
  if (req.action === 'unknown') return reply(`Sorry, I didn't get that.\n\n${HELP}`);

  if (req.action === 'list') {
    const list = active();
    if (!list.length) return reply('Nothing scheduled right now. Text me something like "book saturday 8:30".');
    return reply(list.map((j) => `#${j.n}  ${describe(j)}\n   ${j.status === 'running' ? '⏳ booking now' : `opens ${when(j.openAt)}`}`).join('\n\n'));
  }

  if (req.action === 'cancel') {
    const list = active();
    const j = req.index ? list.find((x) => x.n === req.index) : req.date ? list.find((x) => x.date === req.date) : list.length === 1 ? list[0] : null;
    if (!j) return reply(list.length ? 'Which one? Send "list" to see them, then e.g. "cancel 3".' : 'There is nothing scheduled to cancel.');
    const wasRunning = j.status === 'running';
    if (wasRunning && running && running.job === j) running.child.kill();
    j.status = 'cancelled';
    save();
    return reply(`Cancelled: ${dayName(j.date)} at ${time12(j.times[0])}.${wasRunning ? ' If it was already booked, remove it from your cart on the club site.' : ''}`);
  }

  // ----- book -----
  if (!req.date) return reply('Which day? For example: "book saturday 8:30".');
  if (req.date < ymd(now)) return reply(`${dayName(req.date)} has already passed.`);

  const defaults = (process.env.FALLBACK_TIMES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const times = req.times.length ? [...req.times] : [process.env.TEE_TIME || '08:30'];
  if (!req.only) for (const t of defaults) if (t > times[0] && !times.includes(t)) times.push(t);

  const players = req.players.length ? req.players : (process.env.PLAYERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const weekend = [0, 6].includes(new Date(`${req.date}T12:00:00`).getDay());
  if (weekend && players.length < 3) return reply('Weekends need at least 3 players. Add them like: "book saturday 8:30 with 4299-1, 4299, 4299-c".');

  const job = {
    n: state.nextNumber++,
    date: req.date,
    times,
    players,
    course: req.course || process.env.COURSE_ID || '1',
    rate: req.holes === 9 ? 'GF 09H SOCIOS' : req.holes === 18 ? 'GF 18H SOCIOS' : process.env.RATE || 'GF 18H SOCIOS',
    openAt: openingTime(req.date),
    status: 'scheduled',
    checked: false,
  };

  const clash = active().find((x) => x.date === job.date || Math.abs(x.openAt - job.openAt) < 30 * 60 * 1000);
  if (clash) return reply(`You already have ${dayName(clash.date)} scheduled, and I can only grab one tee time per opening. Send "cancel ${clash.n}" first if you want to replace it.`);

  state.jobs.push(job);
  save();
  if (job.openAt <= Date.now()) return reply(`Got it ✅\n${describe(job)}\n\nThat day is already open, so I'm booking it now…`).then(tick);
  return reply(`Got it ✅\n${describe(job)}\n\nBooking opens ${when(job.openAt)}. I'll grab it the second it opens and message you.\n\nTo undo, text "cancel ${job.n}".`);
}

// ---------- running bot.js ----------
let running = null; // only one browser at a time (they share the saved login)

function runBot(job, args, onExit) {
  const full = ['bot.js', `--date=${job.date}`, `--times=${job.times.join(',')}`, `--players=${job.players.join(',')}`, `--course=${job.course}`, `--rate=${job.rate}`, ...args];
  log('starting bot', full.slice(1).join(' '));
  const child = spawn(process.execPath, full, { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = fs.createWriteStream(path.join(__dirname, 'bot.log'), { flags: 'a' });
  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });
  running = { job, child };
  child.on('close', (code) => {
    out.end();
    running = null;
    log('bot finished with code', code);
    onExit(code);
    save();
    tick();
  });
}

function tick() {
  if (running) return;
  const now = Date.now();
  for (const j of active()) {
    // the day itself is over
    if (j.date < ymd(new Date())) { j.status = 'expired'; save(); continue; }

    // booking time
    if (now >= j.openAt - START_EARLY_MS) {
      j.status = 'running';
      save();
      return runBot(j, now >= j.openAt ? ['--now'] : [], (code) => {
        if (j.status === 'running') j.status = code === 0 ? 'done' : 'failed';
        // bot.js already messaged you with the result (held / not available / error)
      });
    }

    // login check the evening before (not if opening is under 30 min away)
    if (!j.checked && now >= j.openAt - CHECK_BEFORE_MS && j.openAt - now > 30 * 60 * 1000) {
      j.checked = true;
      save();
      return runBot(j, ['--check-login'], (code) => {
        if (code === 0) reply(`👍 Still logged in to the club site. All set for ${dayName(j.date)} — booking opens ${when(j.openAt)}.`);
        // if logged out, bot.js already sent the "LOGGED OUT" alert
      });
    }
  }
}

// ---------- main loop ----------
async function poll() {
  for (;;) {
    try {
      const updates = await tg('getUpdates', { offset: state.offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        state.offset = u.update_id + 1;
        save();
        const m = u.message;
        if (!m || !m.text) continue;
        if (String(m.chat.id) !== CHAT) { log('ignored message from unknown chat', m.chat.id); continue; }
        await handle(m.text).catch((e) => { log('error:', e.message); reply(`Something went wrong: ${e.message}`); });
      }
    } catch (e) {
      log('Telegram connection problem, retrying:', e.message);
      await sleep(5000);
    }
  }
}

log('Tee-time assistant started.');
// A booking that was in progress when the computer restarted is NOT retried
// automatically: it may already be in your cart, and retrying could book twice.
for (const j of state.jobs) {
  if (j.status !== 'running') continue;
  j.status = 'interrupted';
  reply(`⚠️ The computer restarted while I was booking ${dayName(j.date)}. Check your cart on the club site. If it isn't there, text me to book it again.`);
}
save();
setInterval(tick, 20 * 1000);
tick();
poll();
