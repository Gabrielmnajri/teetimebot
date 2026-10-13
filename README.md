# Tee-Time Assistant (Santo Domingo Country Club)

Text your assistant on Telegram, for example **"book saturday 8:30"**. It replies with the plan and takes it from there:

- **If booking for that day hasn't opened yet** (it opens the day before at 8:00 AM), it waits. The evening before, it checks you're still logged in to the club site. At 8:00:00 it grabs the slot faster than anyone can click.
- **If that day is already open**, it books right away.
- If your time is taken, it tries the backup times (9:00, then 10:00 by default).
- Once the slot is held, it opens the payment page on the computer and messages you. You enter the card security code and pay within about 15 minutes.

## Things you can text it

| You text | What happens |
|---|---|
| `book saturday 8:30` | Saturday 8:30, backups 9:00 and 10:00, your usual 3 players |
| `book saturday 8:30 or 9:00 with 4299-1, 4299, 4299-c` | Choose the times and players |
| `book oct 24 10am only` | Just that time, no backups |
| `book sunday 7:30 los robles 9 holes` | Other course and rate |
| `list` | See what's scheduled |
| `cancel 3` or `cancel saturday` | Cancel one |
| `help` | Shows these examples |

It understands English and Spanish (`sabado`, `mañana`, `hoyos`…) and dates like `oct 24`, `24/10` or `tomorrow`. Only you can use it. It ignores messages from anyone else.

## Setup (Windows, about 15 minutes, no coding)

1. **Download:** on this GitHub page, click the green **Code** button, then **Download ZIP**.
2. **Unzip:** find the zip in your Downloads folder, right-click it, choose **Extract All…**, then **Extract**. Put the folder somewhere permanent, like `C:\teetime-bot`.
3. **Run setup:** open the folder and double-click **SETUP**. If Windows shows a warning, click **More info** → **Run anyway** (or just **Run**).
4. **Follow the steps on screen.** The setup:
   - installs everything it needs (click **Yes** if Windows asks for permission)
   - helps you create your Telegram assistant with **BotFather**, Telegram's official tool for making bots
   - opens the club website. Log in, then close that window.
   - starts the assistant and makes it start by itself every time you sign in to Windows

You can run **SETUP** again at any time.

## Keep in mind

- The computer must be **on, plugged in and signed in to Windows**. Setup stops it from sleeping while plugged in.
- If Telegram says **"LOGGED OUT"**, double-click **LOGIN-AGAIN** in the folder and log in.
- Keep the clock exact: Settings → Time & language → Date & time → **Sync now**. If the clock is 2 seconds slow, it starts 2 seconds late.
- One tee time per opening. It can't grab two different days that open at the same moment.
- Logs, if something goes wrong: `assistant.log` and `bot.log` in the folder.

## Changing the defaults

Open `.env` in the folder with Notepad. `TEE_TIME`, `FALLBACK_TIMES`, `RATE`, `PLAYERS` and `COURSE_ID` are what the assistant uses when your message doesn't say. Or just ask Claude to change them.

## How it's fast

- It doesn't click through the website. It sends the booking straight to the club's own booking system, the same thing the **Confirmar** button does.
- From **8:00:00.000** it sends your booking every 250 ms and checks the tee sheet every 150 ms. The first attempt after the day opens books it.
- It only sends one booking at a time, so it can never double-book you.

## Moving to the Mac mini later

The assistant code works on a Mac without changes. Only the "start automatically" step is different, and we'll set that up when the Mac mini arrives.

## Notes

- Your password and card details are never stored. It reuses the login session saved in `browser-profile/`.
- Your Telegram details are saved only in `.env` on your computer and are never uploaded to GitHub.
- For testing from a Command Prompt: `npm run dry-run -- --date=YYYY-MM-DD --times=12:10` checks which time it *would* book on an open day, without booking.
