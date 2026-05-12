import http from 'node:http';
import { URL } from 'node:url';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import fs from 'node:fs';
import {
  CREDENTIALS_PATH,
  DEFAULT_SCOPES,
  TOKEN_PATH,
  ensureDataDir,
  loadJson,
  requireCredentials,
  saveJson,
} from './config.mjs';

function buildOAuthClient(redirectUri) {
  const client = requireCredentials();
  const chosenRedirectUri = redirectUri || client.redirect_uris?.[0] || 'http://127.0.0.1';
  return new google.auth.OAuth2(client.client_id, client.client_secret, chosenRedirectUri);
}

export async function getAuthorizedClient() {
  ensureDataDir();

  if (fs.existsSync(TOKEN_PATH)) {
    const oauth2Client = buildOAuthClient();
    oauth2Client.setCredentials(loadJson(TOKEN_PATH));
    return oauth2Client;
  }

  throw new Error('No saved Google token found. Run `npm run auth` first.');
}

export async function runAuthFlow() {
  ensureDataDir();
  requireCredentials();

  const auth = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: DEFAULT_SCOPES,
  });

  if (!auth.credentials?.refresh_token) {
    throw new Error('Google did not return a refresh token. Remove token.json and retry after revoking app access if needed.');
  }

  saveJson(TOKEN_PATH, auth.credentials);
  return auth;
}

export function getManualAuthUrl(port = 3007) {
  ensureDataDir();
  requireCredentials();

  const redirectUri = `http://localhost:${port}`;
  const oauth2Client = buildOAuthClient(redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DEFAULT_SCOPES,
  });

  return { authUrl, redirectUri };
}

export async function exchangeManualAuthCode(code, port = 3007) {
  ensureDataDir();
  requireCredentials();

  const redirectUri = `http://localhost:${port}`;
  const oauth2Client = buildOAuthClient(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens?.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke the app in Google Account permissions and retry.');
  }

  oauth2Client.setCredentials(tokens);
  saveJson(TOKEN_PATH, tokens);
  return { redirectUri };
}

export async function startManualAuthFlow(port = 3007) {
  const { authUrl, redirectUri } = getManualAuthUrl(port);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, redirectUri);
        if (url.pathname !== '/') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error) {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`Google OAuth error: ${error}`);
          server.close();
          reject(new Error(`Google OAuth error: ${error}`));
          return;
        }
        if (!code) {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Missing authorization code.');
          return;
        }

        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Google Calendar authorization received. You can close this tab and return to Milo.');
        server.close();
        resolve(code);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      process.stdout.write(`${JSON.stringify({ ok: true, authUrl, redirectUri }, null, 2)}\n`);
    });

    server.on('error', reject);
  });

  await exchangeManualAuthCode(code, port);
  return { authUrl, redirectUri };
}

export async function getCalendarClient() {
  const auth = await getAuthorizedClient();
  return google.calendar({ version: 'v3', auth });
}

export async function waitForWebhook(port = 8787, timeoutMs = 5 * 60_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for webhook notification.'));
    }, timeoutMs);

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const body = {
        method: req.method,
        path: url.pathname,
        headers: req.headers,
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      clearTimeout(timer);
      server.close();
      resolve(body);
    });

    server.listen(port, '127.0.0.1');
  });
}
