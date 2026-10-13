// Turns a text message like "book saturday 8:30 with 4299, 4299-c" into a
// request the assistant understands. English and Spanish both work.

const DAYS = {
  sunday: 0, sun: 0, domingo: 0,
  monday: 1, mon: 1, lunes: 1,
  tuesday: 2, tue: 2, tues: 2, martes: 2,
  wednesday: 3, wed: 3, miercoles: 3,
  thursday: 4, thu: 4, thurs: 4, jueves: 4,
  friday: 5, fri: 5, viernes: 5,
  saturday: 6, sat: 6, sabado: 6,
};
const MONTHS = {
  jan: 1, january: 1, enero: 1, feb: 2, february: 2, febrero: 2, mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, abril: 4, may: 5, mayo: 5, jun: 6, june: 6, junio: 6, jul: 7, july: 7, julio: 7,
  aug: 8, august: 8, agosto: 8, sep: 9, sept: 9, september: 9, septiembre: 9,
  oct: 10, october: 10, octubre: 10, nov: 11, november: 11, noviembre: 11, dec: 12, december: 12, diciembre: 12,
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clean = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function parseDate(t, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

  let m = t.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/\b(today|hoy)\b/.test(t)) return ymd(today);
  if (/\b(day after tomorrow|pasado manana)\b/.test(t)) return ymd(plus(2));
  if (/\b(tomorrow|manana)\b/.test(t)) return ymd(plus(1));

  const monthNames = Object.keys(MONTHS).join('|');
  const pick = (mo, day) => {
    const d = new Date(today.getFullYear(), mo - 1, day);
    if (d.getMonth() !== mo - 1) return null;
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return ymd(d);
  };
  m = t.match(new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (m) return pick(MONTHS[m[1]], +m[2]);
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+|of\\s+)?(${monthNames})\\b`));
  if (m) return pick(MONTHS[m[2]], +m[1]);
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\b/); // day/month, as written in the DR
  if (m) return pick(+m[2], +m[1]);

  for (const [name, dow] of Object.entries(DAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      const ahead = (dow - today.getDay() + 7) % 7 || 7; // "saturday" = the next one
      return ymd(plus(ahead));
    }
  }
  return null;
}

function parseTimes(t) {
  const times = [];
  // needs a colon/dot or am/pm, so member numbers like 4299 are never read as times
  const re = /\b(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?=[^\w-]|$)/g;
  let m;
  while ((m = re.exec(t))) {
    if (!m[2] && !m[3]) continue;
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const ap = (m[3] || '').replace(/\./g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 6) h += 12; // "2:00" on a golf course means 2 PM
    if (h > 23 || min > 59) continue;
    const s = `${pad(h)}:${pad(min)}`;
    if (!times.includes(s)) times.push(s);
  }
  return times;
}

// Returns { action: 'book' | 'list' | 'cancel' | 'help' | 'unknown', ... }
function parse(text, now = new Date()) {
  const t = clean(text).replace(/[,;]/g, ' ');

  if (/^\/?(start|help|ayuda)\b/.test(t) || /\bwhat can you do\b/.test(t)) return { action: 'help' };
  if (/\b(list|status|bookings|booked|reservas|pending|scheduled)\b/.test(t) && !/\bbook (me|for)\b/.test(t)) return { action: 'list' };

  const date = parseDate(t, now);
  if (/\b(cancel|cancelar|remove|delete|borrar)\b/.test(t)) {
    const n = t.match(/\b(?:cancel|cancelar|remove|delete|borrar)\s+#?(\d{1,2})\b/);
    return { action: 'cancel', date, index: n ? +n[1] : null };
  }

  const times = parseTimes(t);
  const players = t.replace(/\b20\d\d-\d\d-\d\d\b/g, ' ').match(/\b\d{4}(?:-[0-9a-z])?\b/g) || [];
  const course = /\brobles\b/.test(t) ? '2' : /\bsenior\b/.test(t) ? '1' : null;
  const holes = /\b9\s*(holes|hoyos|h)\b/.test(t) ? 9 : /\b18\s*(holes|hoyos|h)\b/.test(t) ? 18 : null;
  const only = /\b(only|solo|solamente|no backups?)\b/.test(t);

  if (!date && !times.length && !/\b(book|reserva|reservar|tee)\b/.test(t)) return { action: 'unknown' };
  return { action: 'book', date, times, players, course, holes, only };
}

module.exports = { parse, parseTimes, parseDate, ymd };
