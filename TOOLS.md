---
summary: "Workspace template for TOOLS.md"
read_when:
  - Bootstrapping a workspace manually
---

# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### Slack

- My user ID: U0B2XUKL410


- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

### Google Calendar

- **DO NOT USE `gcalcli`**. It is not authenticated.
- Use the custom `google-calendar-bridge` tool located in the workspace.
- **Location:** `google-calendar-bridge/`
- **Usage:** Run `npm run <command> -- --parameters` from within the directory.
- **Example (Create Event):** `cd google-calendar-bridge && npm run create -- --calendar primary --title "..." --start "..." --end "..." --attendees "..."`
- Refer to `google-calendar-bridge/README.md` for all available commands and options.
