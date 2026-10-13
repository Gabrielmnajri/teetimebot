// Santo Domingo Country Club tee-time bot
//
// Flow (mapped from the live site):
//   tee sheet -> click slot -> rate row "3" players -> fill "Identificador" x3
//   -> Confirmar (slot now HELD ~15 min in cart) -> accept terms -> Pagar
//   -> "Pagar con ****" saved card -> Pagar -> AZUL page (YOU enter the CVV)
//
// Flags:
//   --dry-run     poll + decide which slot it would book, but send nothing
//   --now         skip waiting for 8:00 (use with --date to test any day)
//   --date=YYYY-MM-DD  override target date (default: next Saturday)
//   --times=12:10,12:20  override times (handy for dry runs on weekdays)
//   --players=4299-1,4299  --course=2  --rate="GF 09H SOCIOS"  override .env
//   --check-login just check the club login is still valid (alert if not)
//   --test-alert  just send a WhatsApp test message and exit

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'https://countryclub.golfmanager.com';
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const argVal = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];

const cfg = {
  course: process.env.COURSE_ID || '1',
  teeTime: process.env.TEE_TIME || '08:30',
  fallbacks: (process.env.FALLBACK_TIMES || '').split(',').map((s) => s.trim()).filter(Boolean),
  rate: process.env.RATE || 'GF 18H SOCIOS',
  players: (process.env.PLAYERS || '').split(',').map((s) => s.trim()).filter(Boolean),
  pollStart: process.env.POLL_START || '07:59:45',
  pollEnd: process.env.POLL_END || '08:05:00',
  openTime: process.env.OPEN_TIME || '08:00',
  phone: process.env.WHATSAPP_PHONE,
  apikey: process.env.CALLMEBOT_APIKEY,
  tgToken: process.env.TELEGRAM_BOT_TOKEN,
  tgChat: process.env.TELEGRAM_CHAT_ID,
};
if (argVal('players')) cfg.players = argVal('players').split(',').map((s) => s.trim()).filter(Boolean);
if (argVal('course')) cfg.course = argVal('course');
if (argVal('rate')) cfg.rate = argVal('rate');

const log = (...m) => console.log(new Date().toLocaleTimeString('es-DO', { hour12: false }), ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7));
  return ymd(d);
}

function todayAt(hms) {
  const [h, m, s = 0] = hms.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, s, 0);
  return d;
}

// Sends an alert to Telegram and/or WhatsApp, whichever is set up in .env
async function notify(text) {
  if (cfg.tgToken && cfg.tgChat) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${cfg.tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.tgChat, text }),
      });
      log('Telegram sent:', r.status);
    } catch (e) {
      log('Telegram failed:', e.message);
    }
  }
  if (!cfg.phone || !cfg.apikey) return cfg.tgToken || log('(alerts not configured)', text);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${cfg.phone}&apikey=${cfg.apikey}&text=${encodeURIComponent(text)}`;
  try {
    const r = await fetch(url);
    log('WhatsApp sent:', r.status);
  } catch (e) {
    log('WhatsApp failed:', e.message);
  }
}

async function main() {
  if (flag('test-alert')) return notify('⛳ Tee-time bot test: alerts are working.');

  const date = argVal('date') || nextSaturday();
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
  if (weekend && cfg.players.length < 3) throw new Error('Weekends need at least 3 member numbers.');
  if (argVal('times')) { const t = argVal('times').split(','); cfg.teeTime = t[0]; cfg.fallbacks = t.slice(1); }
  const times = [cfg.teeTime, ...cfg.fallbacks];
  const sheetUrl = `${BASE}/consumer/ebookings?i=1&resourcetype=1&date=${date}&resource=${cfg.course}`;
  log(`Target: ${date}  times: ${times.join(', ')}  rate: ${cfg.rate}  players: ${cfg.players.join(', ')}`);

  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'browser-profile'), {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  // 1) Make sure we're logged in
  await page.goto(sheetUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const loggedIn = await page.getByText(/Hola\s/i).first().isVisible().catch(() => false);
  if (!loggedIn) {
    await notify('⚠️ Tee-time bot: you are LOGGED OUT of the Country Club site. On the computer, double-click LOGIN-AGAIN in the bot folder and log in.');
    throw new Error('Not logged in. Run: npm run login');
  }
  log('Logged in ✔');
  if (flag('check-login')) return ctx.close();

  // Warn if something is already sitting in the cart (it would be paid together)
  const cartLines = await page
    .evaluate(async () => ((await (await fetch('/eshop/cart.api?cachebreaker=' + Date.now())).json()).lines || []).length)
    .catch(() => 0);
  if (cartLines > 0) {
    log(`Note: cart already has ${cartLines} item(s).`);
    await notify(`ℹ️ Heads up: your club cart already has ${cartLines} item(s). Empty it before booking opens so you only pay for this tee time.`);
  }

  // 2) Wait until polling window
  if (!flag('now')) {
    const start = todayAt(cfg.pollStart);
    const wait = start - Date.now();
    if (wait > 0) {
      log(`Waiting ${Math.round(wait / 1000)}s until ${cfg.pollStart}…`);
      await sleep(wait);
    }
  }

  // Fresh page right before the race
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1000);

  // 3) FAST PATH. Poll availability every ~150 ms. The moment the day opens,
  //    send the reservation straight to the club's own booking endpoint
  //    (same call the "Confirmar" button makes) - no clicking, no page loads.
  const hasFastApi = await page.evaluate(() => typeof window.S?.postJson === 'function' && typeof window.S?.parseDate === 'function');
  log(hasFastApi ? 'Fast booking mode ready ✔' : 'Fast mode unavailable - will use click mode');

  const poll = () =>
    page
      .evaluate(
        async ({ course, date }) => {
          const r = await fetch(`/ebookings/init.api?idResourceType=1&idResource=${course}&start=${date}&cachebreaker=${Date.now()}`);
          const j = await r.json();
          return (j.availability || []).map((a) => ({
            time: a.date.slice(11, 16),
            start: a.date,
            slots: a.slots,
            types: (a.types || []).map((t) => ({ id: t.idType ?? t.id, name: t.name })),
          }));
        },
        { course: cfg.course, date }
      )
      .catch((e) => (log('poll error', e.message), null));

  const fastBook = (slot, idType) =>
    page.evaluate(
      ({ slot, idType, players, course }) =>
        new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ ok: false, err: 'timeout' }), 15000);
          const reservations = players.map((p) => ({
            idType,
            idResource: Number(course),
            start: S.parseDate(slot.start),
            name: p,
            customTag: '',
          }));
          S.postJson({
            url: '/ebookings/makeReservation.api',
            spinner: false,
            data: { reservations, includeSession: true },
            onSuccess: () => { clearTimeout(timer); resolve({ ok: true }); },
            onError: (e) => { clearTimeout(timer); resolve({ ok: false, err: String(e) }); },
          });
        }),
      { slot, idType, players: cfg.players, course: cfg.course }
    );

  const deadline = flag('now') ? Date.now() + 15000 : todayAt(cfg.pollEnd).getTime();
  const attempts = Object.fromEntries(times.map((t) => [t, 0]));
  const dead = new Set();
  let chosen = null;
  let openedAt = null;
  let polls = 0;

  // 3a) RACE for the primary time. From 08:00:00.000 (local clock) fire the
  //     reservation every 250 ms while overlapping availability polls run
  //     every 150 ms. First success wins. If the day opens and the primary
  //     time is already gone, stop immediately and move to the backups.
  if (!flag('dry-run') && hasFastApi) {
    const rateId = await page
      .evaluate(async ({ course, rate }) => {
        const d = new Date(); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const j = await (await fetch(`/ebookings/init.api?idResourceType=1&idResource=${course}&start=${ds}&cachebreaker=${Date.now()}`)).json();
        for (const a of j.availability || []) for (const t of a.types || []) if (t.name === rate) return t.idType ?? t.id;
        return null;
      }, { course: cfg.course, rate: cfg.rate })
      .catch(() => null) || Number(process.env.RATE_TYPE_ID || 3);
    log(`Rate "${cfg.rate}" = idType ${rateId}. Racing for ${cfg.teeTime}…`);

    const fireAt = flag('now') ? Date.now() : todayAt(cfg.openTime).getTime();
    const race = await page.evaluate(
      ({ course, date, primary, idType, players, fireAt, deadline }) =>
        new Promise((resolve) => {
          const startStr = `${date}T${primary}:00`;
          let done = false, fired = 0, inflight = 0, lastErr = null, openedAt = null, polls = 0;
          const finish = (r) => { if (done) return; done = true; clearInterval(pi); clearInterval(si); resolve({ ...r, fired, polls, lastErr, openedAt }); };
          const book = () => {
            if (done || fired >= 40 || inflight >= 1) return; // one request at a time = never double-book
            fired++; inflight++;
            S.postJson({
              url: '/ebookings/makeReservation.api',
              spinner: false,
              data: { reservations: players.map((p) => ({ idType, idResource: Number(course), start: S.parseDate(startStr), name: p, customTag: '' })), includeSession: true },
              onSuccess: () => { inflight--; finish({ ok: true, at: Date.now() }); },
              onError: (e) => { inflight--; lastErr = String(e); },
            });
          };
          const pi = setInterval(async () => {
            if (done) return;
            if (Date.now() > deadline) return finish({ ok: false, reason: 'timeout' });
            try {
              const j = await (await fetch(`/ebookings/init.api?idResourceType=1&idResource=${course}&start=${date}&cachebreaker=${Date.now()}`)).json();
              polls++;
              const av = j.availability || [];
              if (!av.length || done) return;
              if (!openedAt) openedAt = Date.now();
              const s = av.find((a) => a.date.slice(11, 16) === primary);
              const ok = s && s.slots >= players.length && (s.types || []).some((t) => (t.idType ?? t.id) === idType);
              if (ok) book();
              else if (inflight === 0) finish({ ok: false, reason: 'taken' });
            } catch (e) {}
          }, 150);
          const si = setInterval(() => { if (Date.now() >= fireAt) book(); }, 250);
        }),
      { course: cfg.course, date, primary: cfg.teeTime, idType: rateId, players: cfg.players, fireAt, deadline: Math.min(deadline, fireAt + 60000) }
    );
    if (race.ok) {
      chosen = cfg.teeTime;
      log(`BOOKED ${cfg.teeTime} ✔  (${race.fired} attempts, ${race.openedAt ? race.at - race.openedAt + ' ms after day opened' : 'before first poll saw it open'})`);
    } else {
      log(`${cfg.teeTime} lost (${race.reason}; last error: ${race.lastErr || 'none'}) - trying backups`);
      if (race.reason !== 'timeout') dead.add(cfg.teeTime);
      openedAt = race.openedAt;
    }
  }

  while (Date.now() < deadline && !chosen && dead.size < times.length) {
    const avail = await poll();
    polls++;
    if (!avail || avail.length === 0) { await sleep(150); continue; } // not open yet
    if (!openedAt) { openedAt = Date.now(); log(`Day is OPEN (after ${polls} polls) - booking now`); }

    for (const t of times) {
      if (dead.has(t)) continue;
      const s = avail.find((a) => a.time === t);
      const type = s && s.types.find((x) => x.name === cfg.rate);
      if (!s || s.slots < cfg.players.length || !type) {
        log(`${t}: not available (${s ? s.slots + ' spots' : 'already taken'}) - next backup`);
        dead.add(t);
        continue;
      }
      if (flag('dry-run')) {
        log(`DRY RUN: would book ${t} (idType ${type.id}) for ${cfg.players.join(', ')} - nothing sent.`);
        chosen = t;
        break;
      }
      if (!hasFastApi) { chosen = t; break; } // let click mode handle it
      const t0 = Date.now();
      const res = await fastBook(s, type.id);
      attempts[t]++;
      if (res.ok) {
        chosen = t;
        log(`BOOKED ${t} in ${Date.now() - t0} ms (${Date.now() - openedAt} ms after opening) ✔`);
        break;
      }
      log(`${t}: booking failed - ${res.err}`);
      if (attempts[t] >= 2 || /confirmada|otro usuario|no se permiten|ocupad/i.test(res.err)) dead.add(t);
    }
  }

  if (!chosen) {
    await notify(`❌ Tee-time bot: could not get ${times.join(' / ')} for ${date}. Check the site now.`);
    throw new Error('No matching slot booked before deadline.');
  }

  if (flag('dry-run')) {
    await notify(`🧪 Tee-time bot dry run OK: ${date} ${chosen} was bookable (nothing booked).`);
    await sleep(5000);
    return ctx.close();
  }

  // 4) Click-mode fallback (only if the fast API wasn't available)
  if (!hasFastApi) {
    await page.goto(sheetUrl, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.bookingTimes .card').filter({ has: page.locator('.hour', { hasText: new RegExp(`^${chosen}$`) }) });
    await card.first().click({ timeout: 10000 });
    const rateBox = page.locator('.infoContainer').filter({ has: page.locator('.infoTitle', { hasText: cfg.rate }) });
    await rateBox.locator('.tabButton', { hasText: String(cfg.players.length) }).first().click({ timeout: 10000 });
    const inputs = rateBox.locator('input[placeholder="Identificador"]');
    await inputs.first().waitFor({ timeout: 10000 });
    for (let i = 0; i < cfg.players.length; i++) await inputs.nth(i).fill(cfg.players[i]);
    await page.locator('.nextButton', { hasText: 'Confirmar' }).click();
    await page.waitForURL(/\/eshop\/cart/, { timeout: 20000 });
  }

  // 5) Slot is HELD in the cart - tell Gabriel immediately
  log('Slot HELD in cart ✔');
  await notify(`✅ Tee time HELD: ${date} ${chosen}, Campo ${cfg.course === '1' ? 'Senior' : 'Los Robles'}, ${cfg.players.length} players. Pay within ~15 min!`);
  await page.goto(`${BASE}/consumer/eshop/cart`, { waitUntil: 'domcontentloaded' });
  const linesNow = await page
    .evaluate(async () => ((await (await fetch('/eshop/cart.api?cachebreaker=' + Date.now())).json()).lines || []).length)
    .catch(() => 0);
  if (linesNow > cfg.players.length) {
    await notify(`⚠️ Cart has ${linesNow} items (expected ${cfg.players.length}). Remove extras before paying.`);
  }

  // 8) Cart -> accept terms -> Pagar
  await page.locator('input.acceptTerms').check({ timeout: 10000 });
  await page.locator('div.payButton', { hasText: 'Pagar' }).click();

  // 9) Payment method: saved card -> Pagar
  try {
    const saved = page.getByText(/Pagar con \*+/).first();
    await saved.waitFor({ timeout: 15000 });
    await saved.click();
    await page.getByText('Pagar', { exact: true }).last().click();
    await page.waitForURL(/azul\.com\.do/, { timeout: 30000 });
    log('On AZUL payment page — waiting for you to enter the CVV.');
    await notify('💳 Payment page is open on the PC. Enter the card security code and pay. (Or pay from the cart on your phone.)');
  } catch (e) {
    log('Could not reach AZUL automatically:', e.message);
    await notify('⚠️ Slot is in your cart but I could not open the payment page. Go to the cart and pay now.');
  }

  // Keep window open 20 min so you can finish paying
  await sleep(20 * 60 * 1000);
  await ctx.close();
}

main().catch(async (e) => {
  log('ERROR:', e.message);
  if (!/Not logged in|No matching slot/.test(e.message)) {
    await notify(`⚠️ Tee-time bot error: ${e.message.slice(0, 200)}. Book manually now!`);
  }
  process.exitCode = 1;
});
