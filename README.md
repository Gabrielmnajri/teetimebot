# Tee-Time Bot (Santo Domingo Country Club)

Every Friday at 8:00 AM it grabs Saturday's **8:30 AM, Campo Senior, GF 18H SOCIOS** for players **4299-1, 4299, 4299-c**. If 8:30 is gone, it tries **9:00**, then **10:00**. Then it opens the payment page and sends you a WhatsApp message. You type the card security code and pay. You have about 15 minutes before the hold expires.

## One-time setup (Windows)

1. **Install Node.js.** Download the LTS version from nodejs.org and accept the defaults.
2. **Put this folder** somewhere simple, e.g. `C:\teetime-bot`.
3. **Install the bot.** Open *Command Prompt* in that folder and run:
   ```
   npm install
   npx playwright install chromium
   ```
4. **Set up WhatsApp alerts (CallMeBot, free):**
   - Go to **callmebot.com → WhatsApp API** and follow the steps. You save their number in your contacts and send it the activation message.
   - It replies with your **API key**.
5. **Create your settings file.** Copy `.env.example` to `.env`. Fill in `WHATSAPP_PHONE` (e.g. `18095551234`) and `CALLMEBOT_APIKEY`.
6. **Log in once:** run `npm run login`, log in to the club site in the window that opens, then close the window.
7. **Test:**
   - `npm run test-alert` should send you a WhatsApp message.
   - `npm run dry-run -- --date=YYYY-MM-DD` uses any date that's already open. It checks which time it would book and **sends nothing**. On weekdays Campo Senior opens at 12:00, so add times that exist, e.g. `npm run dry-run -- --date=2026-10-13 --times=12:10,12:20`.
8. **Schedule it.** Right-click `schedule-task.bat` and choose *Run as administrator*. Then in Task Scheduler, open **TeeTimeBot → Properties → Conditions** and tick **"Wake the computer to run this task"**.

## How it's fast

- It doesn't click through the website. It sends the booking straight to the club's own booking system, the same thing the **Confirmar** button does.
- At **8:00:00.000** it starts sending the 8:30 booking every 250 ms. At the same time it checks the tee sheet every 150 ms.
- As soon as the day opens, the next attempt books it. If 8:30 has already been taken, it switches to 9:00 and then 10:00 right away.
- It only sends one booking at a time, so it can never double-book you.
- **Keep the PC clock exact.** Once a week, open Command Prompt as administrator and run `w32tm /resync`. Or go to Settings → Time & language → Date & time → **Sync now**. If the clock is 2 seconds slow, the bot starts 2 seconds late.
- Use a wired or strong Wi-Fi connection on Friday mornings.

## Friday checklist

- The PC is **on or asleep (not shut down)**, plugged in, and you're **signed in to Windows**.
- If you get a "LOGGED OUT" WhatsApp message, run `npm run login` right away.

## WhatsApp messages you'll get

| Message | Meaning |
|---|---|
| ✅ Tee time HELD | Slot is yours for ~15 min (message says which time: 8:30, 9:00 or 10:00) |
| 💳 Payment page is open | Enter the security code on the PC and pay |
| ❌ could not get | 8:30, 9:00 and 10:00 were all taken |
| ⚠️ error / logged out | Book manually |

## Changing things

Edit `.env`: `TEE_TIME`, `FALLBACK_TIMES`, `RATE` (`GF 09H SOCIOS` for 9 holes), `PLAYERS`, `COURSE_ID` (2 = Los Robles).

## Moving to the Mac mini later

The bot code works on a Mac without changes. Only the scheduling step is different, and we'll set that up when the Mac mini arrives.

## Notes

- Your password and card details are never stored. The bot reuses the login session saved in `browser-profile/`.
- Log of each run: `bot.log`.
