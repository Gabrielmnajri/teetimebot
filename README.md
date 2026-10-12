# Tee-Time Bot (Santo Domingo Country Club)

Every Friday at 8:00 AM it grabs Saturday's **8:30 AM, Campo Senior, GF 18H SOCIOS** for players **4299-1, 4299, 4299-c**. If 8:30 is gone, it tries **9:00**, then **10:00**. Then it opens the payment page and sends you a WhatsApp message. You type the card security code and pay. You have about 15 minutes before the hold expires.

## Setup (Windows, about 15 minutes, no coding)

1. **Download:** on this GitHub page, click the green **Code** button, then **Download ZIP**.
2. **Unzip:** find the zip in your Downloads folder, right-click it, choose **Extract All…**, then **Extract**.
3. **Run setup:** open the new folder and double-click **SETUP**. If Windows shows a warning, click **More info** → **Run anyway** (or just **Run**).
4. **Answer the questions.** The setup:
   - installs everything the bot needs (click **Yes** if Windows asks for permission)
   - opens the CallMeBot page so you can turn on WhatsApp alerts, then asks for your number and the key they send you
   - sends you a test WhatsApp message
   - opens the club website. Log in, then close that window.
   - schedules the bot for every Friday morning

You can run **SETUP** again at any time, for example to change your WhatsApp details.

## Every Friday morning

- The PC is **on or asleep (not shut down)**, plugged in, and you're **signed in to Windows**.
- If you get a "LOGGED OUT" WhatsApp message, double-click **LOGIN-AGAIN** in the bot folder.
- Keep the PC clock exact: go to Settings → Time & language → Date & time → **Sync now**. If the clock is 2 seconds slow, the bot starts 2 seconds late.
- Use a wired or strong Wi-Fi connection.

## WhatsApp messages you'll get

| Message | Meaning |
|---|---|
| ✅ Tee time HELD | Slot is yours for ~15 min (message says which time: 8:30, 9:00 or 10:00) |
| 💳 Payment page is open | Enter the security code on the PC and pay |
| ❌ could not get | 8:30, 9:00 and 10:00 were all taken |
| ⚠️ error / logged out | Book manually |

## Checking on it

- **Is it scheduled?** Press the Windows key, type **Task Scheduler** and open it. Click **Task Scheduler Library** and look for **TeeTimeBot**.
- **What happened last time?** Open `bot.log` in the bot folder.

## How it's fast

- It doesn't click through the website. It sends the booking straight to the club's own booking system, the same thing the **Confirmar** button does.
- At **8:00:00.000** it starts sending the 8:30 booking every 250 ms. At the same time it checks the tee sheet every 150 ms.
- As soon as the day opens, the next attempt books it. If 8:30 has already been taken, it switches to 9:00 and then 10:00 right away.
- It only sends one booking at a time, so it can never double-book you.

## Changing things

Open `.env` in the bot folder with Notepad. You can change `TEE_TIME`, `FALLBACK_TIMES`, `RATE` (`GF 09H SOCIOS` for 9 holes), `PLAYERS` and `COURSE_ID` (2 = Los Robles). Or ask Claude to do it.

## For testing (optional)

From a Command Prompt in the bot folder:
- `npm run test-alert`: sends a test WhatsApp message.
- `npm run dry-run -- --date=YYYY-MM-DD --times=12:10,12:20`: checks which time it *would* book on a day that's already open. It sends nothing. On weekdays Campo Senior opens at 12:00.

## Moving to the Mac mini later

The bot code works on a Mac without changes. Only the scheduling step is different, and we'll set that up when the Mac mini arrives.

## Notes

- Your password and card details are never stored. The bot reuses the login session saved in `browser-profile/`.
- Your WhatsApp number and key are saved only in `.env` on your PC and are never uploaded to GitHub.
