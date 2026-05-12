# Google Calendar Bridge

Local OAuth-based Google Calendar bridge for Milo.

## What it supports

- OAuth sign-in against a dedicated Google account
- List accessible calendars
- Read upcoming events
- Create events and send invites
- Patch or move existing events
- Track calendar changes using Google sync tokens
- Optional Google push watch registration for webhook-based change notifications

## One-time setup

1. Create a Google Cloud project (or reuse one).
2. Enable **Google Calendar API**.
3. Create an **OAuth client ID** of type **Desktop app**.
4. Download the JSON file and save it as:
   - `google-calendar-bridge/data/credentials.json`
5. Run:
   - `npm run auth`
6. In Google Calendar, share Avi's and Anat's calendars with Milo's Google account and grant:
   - **Make changes to events**

## Commands

- `npm run auth`
- `npm run calendars`
- `npm run upcoming -- --calendar primary --limit 10`
- `npm run create -- --calendar primary --title "Test" --start "2026-05-11T09:00:00+03:00" --end "2026-05-11T09:30:00+03:00" --attendees "a@example.com,b@example.com"`
- `npm run patch -- --calendar primary --event EVENT_ID --title "Updated title"`
- `npm run move -- --calendar primary --event EVENT_ID --start "2026-05-11T10:00:00+03:00" --end "2026-05-11T10:30:00+03:00"`
- `npm run changes -- --calendar primary --store avi-primary`

## Notes

- `data/token.json` stores the refresh token locally.
- `changes` stores sync tokens in `data/*-sync.json` so future runs only fetch changes.
- Google webhook watches expire, so if we later use push notifications we should renew them with a cron job.
