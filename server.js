/* ============================================================
   🚆 RailTrack — Automatic 30-Hour Departure Reminders
   EmailJS version | Multi-recipient support
   Works on Render free tier — no SMTP ports needed
   ============================================================ */
require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const cors    = require('cors');
const fs      = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- ENV CHECK ---------------- */
console.log('🔑 ENV CHECK:');
console.log('   EMAILJS_SERVICE_ID   =', process.env.EMAILJS_SERVICE_ID);
console.log('   EMAILJS_TEMPLATE_ID  =', process.env.EMAILJS_TEMPLATE_ID);
console.log('   EMAILJS_PUBLIC_KEY   =', process.env.EMAILJS_PUBLIC_KEY);
console.log('   EMAILJS_PRIVATE_KEY  =', process.env.EMAILJS_PRIVATE_KEY ? `(set, ${process.env.EMAILJS_PRIVATE_KEY.length} chars)` : '(missing)');
console.log('   TO_EMAIL             =', process.env.TO_EMAIL);
console.log('─────────────────────────────');

/* ---------------- CONFIG ---------------- */
const REMINDER_HOURS = 30;                       // ⏰ 30 hours before departure
const REMINDER_MS    = REMINDER_HOURS * 60 * 60 * 1000;
const LOG_FILE       = process.env.LOG_PATH || './reminders-sent.json';
const TEST_MODE      = false;                    // 🧪 true = send one test email on startup

/* ---------------- Original trips ---------------- */
const trips = [
  { train:"DUMMY TEST TRAIN", number:"00000", pnr:"DUMMY001", from:"TEST STATION (TST)", to:"DESTINATION (DST)", dep:"23:40", date:"Sat, 17 Oct", status:"BOOKED", boarding:"TEST STATION (TST)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"4950235078", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Fri, 16 Oct", status:"CANCELLED", boarding:"Lingampalli (LPI)" },
  { train:"COA SNSI EXP",    number:"17206", pnr:"4866024742", from:"Kakinada Town J (CCT)", to:"Vijayawada Jn. (BZA)",   dep:"05:15", date:"Mon, 19 Oct", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"COA SNSI EXP",    number:"17206", pnr:"4953463920", from:"Kakinada Town J (CCT)", to:"Vijayawada Jn. (BZA)",   dep:"05:15", date:"Wed, 21 Oct", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"4343484318", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Fri, 23 Oct", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"4863609602", from:"Kakinada Town J (CCT)", to:"Lingampalli (LPI)",     dep:"20:20", date:"Sun, 25 Oct", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"COA SNSI EXP",    number:"17206", pnr:"4346326687", from:"Kakinada Town J (CCT)", to:"Vijayawada Jn. (BZA)",   dep:"05:15", date:"Mon, 26 Oct", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"4243886935", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Fri, 30 Oct", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"4443991008", from:"Kakinada Town J (CCT)", to:"Lingampalli (LPI)",     dep:"20:20", date:"Sun, 01 Nov", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"4766074576", from:"Kakinada Town J (CCT)", to:"Secunderabad Jn. (SC)", dep:"20:20", date:"Wed, 11 Nov", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"4952045458", from:"Kakinada Town J (CCT)", to:"Lingampalli (LPI)",     dep:"20:20", date:"Sun, 15 Nov", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"7000621505", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Wed, 18 Nov", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"7000079462", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Fri, 20 Nov", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"3000097661", from:"Kakinada Town J (CCT)", to:"Lingampalli (LPI)",     dep:"20:20", date:"Sun, 22 Nov", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"COCANADA SF EXP", number:"12776", pnr:"3000504320", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"19:00", date:"Wed, 25 Nov", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"5000200384", from:"Kakinada Town J (CCT)", to:"Lingampalli (LPI)",     dep:"20:20", date:"Sun, 29 Nov", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"3000286193", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Fri, 04 Dec", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"5000504486", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Wed, 09 Dec", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"GOUTAMI SF EXP",  number:"12738", pnr:"1000504003", from:"Lingampalli (LPI)",     to:"Kakinada Town J (CCT)", dep:"20:30", date:"Fri, 11 Dec", status:"BOOKED",    boarding:"Lingampalli (LPI)" },
  { train:"COCANADA SF EXP", number:"12775", pnr:"5000586432", from:"Kakinada Town J (CCT)", to:"Lingampalli (LPI)",     dep:"20:20", date:"Sun, 13 Dec", status:"BOOKED",    boarding:"Kakinada Town J (CCT)" }
];

/* ---------------- Reminder log ---------------- */
function getSentLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); }
  catch { return {}; }
}
function saveSentLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

/* ---------------- Date parser (IST-aware) ---------------- */
function parseDeparture(trip) {
  const year = new Date().getFullYear();
  const parts = trip.date.match(/(\w{3}),\s*(\d{1,2})\s*(\w{3})/);
  if (!parts) return null;
  const [, , day, monthStr] = parts;
  const monthMap = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const month = monthMap[monthStr];
  if (month === undefined) return null;
  const [hour, minute] = trip.dep.split(':').map(Number);
  // Build as IST (+05:30) — India Standard Time
  const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T` +
              `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+05:30`;
  return new Date(iso);
}

/* ============================================================
   📧 EmailJS sender — supports MULTIPLE recipients
   ============================================================ */
async function sendReminderEmail(trip, hoursLeft) {
  // Parse TO_EMAIL — supports comma-separated list
  const recipients = (process.env.TO_EMAIL || '')
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0);

  if (recipients.length === 0) {
    throw new Error('No TO_EMAIL recipients configured');
  }

  console.log(`📤 Sending to ${recipients.length} recipient(s): ${recipients.join(', ')}`);

  const payload = {
    service_id:  process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id:     process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      // Recipients — EmailJS accepts comma-separated string in "To Email"
      to_email:   recipients.join(','),
      email:      recipients.join(','),

      // Trip details
      train:      trip.train,
      number:     trip.number,
      pnr:        trip.pnr,
      from:       trip.from,
      to:         trip.to,
      dep:        trip.dep,
      date:       trip.date,
      boarding:   trip.boarding,
      status:     trip.status,

      // Reminder info
      hours_left: hoursLeft.toFixed(1),
      subject:    `⏰ Reminder: ${trip.train} (#${trip.number}) departs in ${hoursLeft.toFixed(1)}h`,
      sent_at:    new Date().toISOString(),

      // Full text body (for templates that use {{{message}}})
      message:
`Hi,

⏰ UPCOMING DEPARTURE REMINDER — ${hoursLeft.toFixed(1)} HOURS TO GO

Train     : ${trip.train} (#${trip.number})
PNR       : ${trip.pnr}
Route     : ${trip.from}  →  ${trip.to}
Departs   : ${trip.date} at ${trip.dep}
Boarding  : ${trip.boarding}
Status    : ${trip.status}

Your train departs in approximately ${hoursLeft.toFixed(1)} hours.
Please plan your journey accordingly.

— RailTrack Reminder Bot`
    }
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`EmailJS ${response.status}: ${errText}`);
  }

  console.log(`📨 Reminder sent for PNR ${trip.pnr} (${hoursLeft.toFixed(1)}h left) → ${recipients.length} recipient(s)`);
}

/* ---------------- Core check ---------------- */
async function checkReminders() {
  const now     = Date.now();
  const sentLog = getSentLog();
  let sentAny   = false;
  let waiting   = 0;

  console.log(`\n⏰ [${new Date().toLocaleString()}] Scanning ${trips.length} trips...`);

  for (const trip of trips) {
    if (trip.status === 'CANCELLED') continue;

    const dep = parseDeparture(trip);
    if (!dep) {
      console.log(`   ⚠️  Could not parse date for ${trip.train}: "${trip.date}"`);
      continue;
    }

    const msLeft    = dep.getTime() - now;
    const hoursLeft = msLeft / 3600000;

    if (msLeft <= 0) continue;                  // already departed

    if (msLeft <= REMINDER_MS) {
      if (sentLog[trip.pnr]) {
        console.log(`   ✓ ${trip.train} (${trip.pnr}) — already reminded`);
        continue;
      }

      console.log(`   🎯 ${trip.train} (${trip.pnr}) departs in ${hoursLeft.toFixed(1)}h — SENDING`);
      try {
        await sendReminderEmail(trip, hoursLeft);
        sentLog[trip.pnr] = {
          sentAt: new Date().toISOString(),
          hoursBefore: hoursLeft.toFixed(2)
        };
        saveSentLog(sentLog);
        sentAny = true;
      } catch (err) {
        console.error(`   ❌ Failed for ${trip.pnr}:`, err.message);
      }
    } else {
      waiting++;
    }
  }

  if (!sentAny) {
    console.log(`   No reminders due. ${waiting} trip(s) still > ${REMINDER_HOURS}h away.`);
  }
}

/* ---------------- Optional one-shot test ---------------- */
async function sendStartupTest() {
  if (!TEST_MODE) return;
  const fakeTrip = {
    train: "TEST TRAIN", number: "99999",
    pnr: "TEST_" + Date.now(),
    from: "A (AAA)", to: "B (BBB)",
    dep: "12:00", date: "Test Day",
    status: "BOOKED", boarding: "AAA"
  };
  try {
    await sendReminderEmail(fakeTrip, REMINDER_HOURS);
    console.log(`🧪 Test email sent (TEST_MODE=true)`);
  } catch (err) {
    console.error(`🧪 Test email failed:`, err.message);
  }
}

/* ---------------- Cron: every 30 min ---------------- */
cron.schedule('*/30 * * * *', () => {
  console.log(`\n🔔 [CRON] Scheduled reminder check`);
  checkReminders();
});

/* ---------------- API ---------------- */
app.get('/', (req, res) => {
  res.send('🚆 RailTrack Reminder Server is running. Visit /api/status to see current state.');
});

app.get('/api/check', async (req, res) => {
  await checkReminders();
  res.json({ ok: true, sent: getSentLog() });
});

app.get('/api/status', (req, res) => {
  const log = getSentLog();
  const recipients = (process.env.TO_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);
  res.json({
    totalTrips:    trips.length,
    cancelled:     trips.filter(t => t.status === 'CANCELLED').length,
    booked:        trips.filter(t => t.status === 'BOOKED').length,
    remindersSent: Object.keys(log).length,
    reminderHours: REMINDER_HOURS,
    recipients:    recipients,
    now:           new Date().toISOString(),
    log
  });
});

/* ---------------- Startup ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('════════════════════════════════════════');
  console.log('🚆 RailTrack Reminder Server');
  console.log('════════════════════════════════════════');
  console.log(`  Port          : ${PORT}`);
  console.log(`  Recipients    : ${process.env.TO_EMAIL}`);
  console.log(`  Reminder at   : ${REMINDER_HOURS} hours before departure`);
  console.log(`  Total trips   : ${trips.length}`);
  console.log(`  Cron          : every 30 minutes`);
  console.log(`  Log file      : ${LOG_FILE}`);
  console.log(`  Test mode     : ${TEST_MODE ? 'ON ⚠️' : 'off'}`);
  console.log(`  Sender        : EmailJS (HTTPS, no SMTP)`);
  console.log('════════════════════════════════════════\n');

  await sendStartupTest();
  await checkReminders();
});
