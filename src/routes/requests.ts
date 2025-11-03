import { Router } from 'express';
import { z } from 'zod';
import { writeRange, getSheetsClient, readRange } from '../lib/sheets';
import { loadEnv } from '../lib/env';
import { sendAdminEmail } from '../lib/email';

const router = Router();

const SHEET = 'Notifications';

const RequestSchema = z.object({
  role: z.literal('Faculty').default('Faculty'),
  name: z.string().optional(),
  message: z.string().min(3)
});

async function ensureHeader() {
  const rows = await readRange({ sheetName: SHEET, rangeA1: 'A1:D1' });
  const header = rows[0] || [];
  if ((header[0] || '').toLowerCase() !== 'timestamp') {
    await writeRange({ sheetName: SHEET, rangeA1: 'A1:D1' }, [[ 'Timestamp', 'Email', 'Role', 'Message' ]]);
  }
}

router.post('/', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { role, name, message } = parsed.data;
  try {
    await ensureHeader();
    const sheets = getSheetsClient();
    const env = loadEnv();
    const ts = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `'${SHEET}'!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[ ts, name || '', role, message ]] }
    });
    // optional email
    sendAdminEmail('New timetable change request', `Role: ${role}\nName: ${name || 'Unknown'}\nMessage: ${message}`).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/', async (_req, res) => {
  try {
    await ensureHeader();
    const rows = await readRange({ sheetName: SHEET, rangeA1: 'A2:D2000' });
    const mapped = rows.map(r => ({
      created_at: String(r[0] || ''),
      name: String(r[1] || ''),
      role: String(r[2] || ''),
      message: String(r[3] || '')
    })).reverse();
    res.json({ rows: mapped });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/export', async (_req, res) => {
  try {
    // No-op: already stored in Notifications sheet; return count
    const rows = await readRange({ sheetName: SHEET, rangeA1: 'A2:D2000' });
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/', async (_req, res) => {
  try {
    await writeRange({ sheetName: SHEET, rangeA1: 'A2:D2000' }, [[ '', '', '', '' ]]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// SSE not supported reliably in Netlify Functions; return 501
router.get('/stream', (_req, res) => {
  res.status(501).json({ error: 'SSE not supported on this host' });
});

export default router;
