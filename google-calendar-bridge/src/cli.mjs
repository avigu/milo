#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { exchangeManualAuthCode, getCalendarClient, getManualAuthUrl, runAuthFlow, startManualAuthFlow } from './auth.mjs';
import { DATA_DIR, ensureDataDir, loadJson, saveJson } from './config.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const [key, inline] = item.slice(2).split('=', 2);
      if (inline !== undefined) args[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
      else args[key] = true;
    } else {
      args._.push(item);
    }
  }
  return args;
}

function must(args, key) {
  if (!args[key]) throw new Error(`Missing required --${key}`);
  return args[key];
}

function print(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

async function cmdAuth() {
  await runAuthFlow();
  print({ ok: true, message: 'Google Calendar OAuth completed.', tokenSaved: true });
}

async function cmdAuthManual(args) {
  const port = Number(args.port || 3007);
  const result = await startManualAuthFlow(port);
  print({ ok: true, message: 'Google Calendar OAuth completed.', tokenSaved: true, ...result });
}

async function cmdAuthUrl(args) {
  const port = Number(args.port || 3007);
  print({ ok: true, ...getManualAuthUrl(port) });
}

async function cmdAuthExchange(args) {
  const port = Number(args.port || 3007);
  const code = must(args, 'code');
  const result = await exchangeManualAuthCode(code, port);
  print({ ok: true, message: 'Google Calendar OAuth completed.', tokenSaved: true, ...result });
}

async function cmdCalendars() {
  const calendar = await getCalendarClient();
  const result = await calendar.calendarList.list();
  print({
    ok: true,
    calendars: (result.data.items || []).map((item) => ({
      id: item.id,
      summary: item.summary,
      primary: item.primary || false,
      accessRole: item.accessRole,
      timeZone: item.timeZone,
    })),
  });
}

async function cmdUpcoming(args) {
  const calendar = await getCalendarClient();
  const calendarId = args.calendar || 'primary';
  const maxResults = Number(args.limit || 10);
  const timeMin = args.from || new Date().toISOString();
  const timeMax = args.to;
  const result = await calendar.events.list({
    calendarId,
    singleEvents: true,
    orderBy: 'startTime',
    timeMin,
    timeMax,
    maxResults,
  });
  print({ ok: true, items: result.data.items || [] });
}

async function cmdCreate(args) {
  const calendar = await getCalendarClient();
  const calendarId = args.calendar || 'primary';
  const attendees = String(args.attendees || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const event = {
    summary: must(args, 'title'),
    description: args.description,
    location: args.location,
    attendees,
    start: args.startDate
      ? { date: args.startDate }
      : { dateTime: must(args, 'start'), timeZone: args.timeZone || 'Europe/Berlin' },
    end: args.endDate
      ? { date: args.endDate }
      : { dateTime: must(args, 'end'), timeZone: args.timeZone || 'Europe/Berlin' },
  };

  const result = await calendar.events.insert({
    calendarId,
    sendUpdates: args.sendUpdates || 'all',
    requestBody: event,
  });
  print({ ok: true, event: result.data });
}

async function cmdPatch(args) {
  const calendar = await getCalendarClient();
  const calendarId = args.calendar || 'primary';
  const eventId = must(args, 'event');
  const patch = {};
  if (args.title) patch.summary = args.title;
  if (args.description) patch.description = args.description;
  if (args.location) patch.location = args.location;
  if (args.start) patch.start = { dateTime: args.start, timeZone: args.timeZone || 'Europe/Berlin' };
  if (args.end) patch.end = { dateTime: args.end, timeZone: args.timeZone || 'Europe/Berlin' };
  if (args.startDate) patch.start = { date: args.startDate };
  if (args.endDate) patch.end = { date: args.endDate };
  if (args.attendees) {
    patch.attendees = String(args.attendees)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  }

  const result = await calendar.events.patch({
    calendarId,
    eventId,
    sendUpdates: args.sendUpdates || 'all',
    requestBody: patch,
  });
  print({ ok: true, event: result.data });
}

async function cmdMove(args) {
  const calendar = await getCalendarClient();
  const calendarId = args.calendar || 'primary';
  const eventId = must(args, 'event');
  const result = await calendar.events.get({ calendarId, eventId });
  const event = result.data;
  event.start = args.startDate
    ? { date: must(args, 'startDate') }
    : { dateTime: must(args, 'start'), timeZone: args.timeZone || 'Europe/Berlin' };
  event.end = args.endDate
    ? { date: must(args, 'endDate') }
    : { dateTime: must(args, 'end'), timeZone: args.timeZone || 'Europe/Berlin' };

  const updated = await calendar.events.update({
    calendarId,
    eventId,
    sendUpdates: args.sendUpdates || 'all',
    requestBody: event,
  });
  print({ ok: true, event: updated.data });
}

function syncStorePath(name) {
  return path.join(DATA_DIR, `${name || 'default'}-sync.json`);
}

async function cmdChanges(args) {
  ensureDataDir();
  const calendar = await getCalendarClient();
  const calendarId = args.calendar || 'primary';
  const storeName = String(args.store || calendarId).replace(/[^a-zA-Z0-9._-]+/g, '_');
  const storePath = syncStorePath(storeName);
  const store = fs.existsSync(storePath) ? loadJson(storePath) : null;

  const params = {
    calendarId,
    singleEvents: true,
    showDeleted: true,
    maxResults: Number(args.limit || 50),
  };

  if (store?.nextSyncToken) {
    params.syncToken = store.nextSyncToken;
  } else {
    params.timeMin = args.from || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  }

  const result = await calendar.events.list(params);
  const nextSyncToken = result.data.nextSyncToken;
  saveJson(storePath, {
    calendarId,
    updatedAt: new Date().toISOString(),
    nextSyncToken,
  });

  print({
    ok: true,
    calendarId,
    firstSync: !store,
    savedSyncToken: Boolean(nextSyncToken),
    items: result.data.items || [],
  });
}

async function cmdWatch(args) {
  const calendar = await getCalendarClient();
  const calendarId = args.calendar || 'primary';
  const address = must(args, 'address');
  const ttl = String(args.ttl || 86400);
  const result = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: crypto.randomUUID(),
      type: 'web_hook',
      address,
      params: { ttl },
    },
  });
  print({ ok: true, watch: result.data });
}

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (command) {
    case 'auth':
      return cmdAuth(args);
    case 'auth-manual':
      return cmdAuthManual(args);
    case 'auth-url':
      return cmdAuthUrl(args);
    case 'auth-exchange':
      return cmdAuthExchange(args);
    case 'calendars':
      return cmdCalendars(args);
    case 'upcoming':
      return cmdUpcoming(args);
    case 'create':
      return cmdCreate(args);
    case 'patch':
      return cmdPatch(args);
    case 'move':
      return cmdMove(args);
    case 'changes':
      return cmdChanges(args);
    case 'watch':
      return cmdWatch(args);
    default:
      print({
        ok: true,
        commands: [
          'auth',
          'auth-manual --port 3007',
          'auth-url --port 3007',
          'auth-exchange --port 3007 --code AUTH_CODE',
          'calendars',
          'upcoming --calendar primary --limit 10',
          'create --calendar primary --title ... --start ... --end ... [--attendees a@b.com,c@d.com]',
          'patch --calendar primary --event EVENT_ID [--title ... --start ... --end ...]',
          'move --calendar primary --event EVENT_ID --start ... --end ...',
          'changes --calendar primary [--store name]',
          'watch --calendar primary --address https://your-webhook.example.com/path',
        ],
      });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
