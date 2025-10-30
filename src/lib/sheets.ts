import { google } from 'googleapis';
import { GoogleAuth, JWTInput } from 'google-auth-library';
import { loadEnv } from './env';

export type SheetRange = {
  sheetName: string;
  rangeA1: string; // e.g., A1:D100
  spreadsheetIdOverride?: string; // optional: read/write different spreadsheet
};

function getAuth() {
  const env = loadEnv();
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  // Prefer base64 JSON, then inline JSON, else key file
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON_B64) {
    try {
      const json = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_B64, 'base64').toString('utf8');
      const credentials = JSON.parse(json) as JWTInput;
      const auth = new GoogleAuth({ credentials, scopes });
      return auth;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON_B64. Falling back to GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
    }
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as JWTInput;
      const auth = new GoogleAuth({ credentials, scopes });
      return auth;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Falling back to GOOGLE_APPLICATION_CREDENTIALS.');
    }
  }
  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
  const auth = new GoogleAuth({ keyFile, scopes });
  return auth;
}

export function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheetExists(sheetName: string): Promise<void> {
  const env = loadEnv();
  const sheets = getSheetsClient();
  const ss = await sheets.spreadsheets.get({ spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID });
  const exists = (ss.data.sheets || []).some(s => s.properties?.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
    });
  }
}

export async function readRange({ sheetName, rangeA1, spreadsheetIdOverride }: SheetRange): Promise<string[][]> {
  const env = loadEnv();
  const sheets = getSheetsClient();
  // Only ensure existence on the primary editable spreadsheet
  try { if (!spreadsheetIdOverride) await ensureSheetExists(sheetName); } catch {}
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetIdOverride || env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `'${sheetName}'!${rangeA1}`
  });
  return (res.data.values as string[][]) || [];
}

export async function writeRange({ sheetName, rangeA1, spreadsheetIdOverride }: SheetRange, values: unknown[][]): Promise<void> {
  const env = loadEnv();
  const sheets = getSheetsClient();
  await ensureSheetExists(sheetName);
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetIdOverride || env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `'${sheetName}'!${rangeA1}`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

export async function clearRange({ sheetName, rangeA1, spreadsheetIdOverride }: SheetRange): Promise<void> {
  const env = loadEnv();
  const sheets = getSheetsClient();
  await ensureSheetExists(sheetName);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: spreadsheetIdOverride || env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `'${sheetName}'!${rangeA1}`
  });
}


