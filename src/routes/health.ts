import { Router } from 'express';
import fs from 'fs';
import { loadEnv } from '../lib/env';
import { getSheetsClient } from '../lib/sheets';

const router = Router();

router.get('/credentials', async (_req, res) => {
  const env = loadEnv();
  const result: Record<string, unknown> = {
    hasSpreadsheetId: Boolean(env.GOOGLE_SHEETS_SPREADSHEET_ID),
    authSource: 'unknown',
    canReadKey: false,
    canAccessSheetsApi: false
  };

  try {
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON_B64) {
      result.authSource = 'inline-json-b64';
      try {
        const json = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_B64, 'base64').toString('utf8');
        JSON.parse(json);
        result.canReadKey = true;
      } catch (e) {
        result.canReadKey = false;
        return res.status(400).json({ ...result, error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON_B64' });
      }
    } else if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      result.authSource = 'inline-json';
      try {
        JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
        result.canReadKey = true;
      } catch (e) {
        result.canReadKey = false;
        return res.status(400).json({ ...result, error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON' });
      }
    } else {
      const keyPath = env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
      result.authSource = `file:${keyPath}`;
      result.canReadKey = fs.existsSync(keyPath);
      if (!result.canReadKey) {
        return res.status(404).json({ ...result, error: `Key file not found at ${keyPath}` });
      }
    }

    // Try a lightweight Sheets call
    try {
      const sheets = getSheetsClient();
      await sheets.spreadsheets.values.get({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: 'A1:A1'
      });
      result.canAccessSheetsApi = true;
      return res.json(result);
    } catch (apiErr) {
      result.canAccessSheetsApi = false;
      return res.status(502).json({ ...result, error: (apiErr as Error).message });
    }
  } catch (err) {
    return res.status(500).json({ ...result, error: (err as Error).message });
  }
});

export default router;


