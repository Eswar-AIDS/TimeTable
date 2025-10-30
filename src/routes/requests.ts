import { Router } from 'express';
import { z } from 'zod';
import db from '../lib/db';
import { sendAdminEmail } from '../lib/email';
import { writeRange, getSheetsClient } from '../lib/sheets';
import { loadEnv } from '../lib/env';

const router = Router();

// Simple in-memory SSE clients
const clients: Array<{ id: number; res: any }> = [];
let clientIdSeq = 1;

const RequestSchema = z.object({
  role: z.literal('Faculty').default('Faculty'),
  name: z.string().optional(),
  message: z.string().min(3)
});

router.post('/', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { role, name, message } = parsed.data;
  const stmt = db.prepare('INSERT INTO requests(role, name, message) VALUES (?, ?, ?)');
  const info = stmt.run(role, name || null, message);
  // read created_at from DB so SSE includes the arrival timestamp
  let created_at: string | null = null;
  try {
    const row = db.prepare('SELECT created_at FROM requests WHERE id = ?').get(info.lastInsertRowid) as any;
    created_at = row?.created_at ?? null;
  } catch {}
  const payload = { id: info.lastInsertRowid, role, name: name || null, message, created_at };
  // notify SSE clients
  for (const c of clients) {
    try { c.res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
  }
  // fire-and-forget email to admin
  sendAdminEmail(
    'New timetable change request',
    `Role: ${role}\nName: ${name || 'Unknown'}\nMessage: ${message}\nRequest ID: ${String(info.lastInsertRowid)}`
  ).catch(() => {});
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all();
  res.json({ rows });
});

// Export notifications to a 'Notifications' sheet (overwrites contents)
router.post('/export', async (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM requests ORDER BY created_at ASC').all();
    const header = ['Timestamp', 'Email', 'Role', 'Message'];
    const values: string[][] = [header];
    for (const r of rows as any[]) {
      values.push([
        String(r.created_at || ''),
        String(r.name || ''),
        String(r.role || ''),
        String(r.message || '')
      ]);
    }
    // Append without removing existing data. If sheet is empty, write header first, then append data rows.
    const sheets = getSheetsClient();
    const env = loadEnv();
    // Read existing values to determine how many rows are already saved
    let existingCount = 0;
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `'Notifications'!A:A`
      });
      existingCount = (existing.data.values?.length || 0);
    } catch {}

    // If sheet is empty, write header first
    if (existingCount === 0) {
      const lastCol = String.fromCharCode(65 + header.length - 1);
      await writeRange({ sheetName: 'Notifications', rangeA1: `A1:${lastCol}1` }, [header]);
    }

    // Determine how many data rows are already present (subtract header if present)
    const existingDataRows = Math.max(0, existingCount - 1);
    // If existing sheet rows exceed current DB rows (e.g., DB was cleared), append all current DB rows
    const baseline = existingDataRows > (rows as any[]).length ? 0 : existingDataRows;
    const newRows = (rows as any[]).slice(baseline).map((r) => [
      String(r.created_at || ''),
      String(r.name || ''),
      String(r.role || ''),
      String(r.message || '')
    ]);

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `'Notifications'!A:A`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: newRows }
      });
    }
    res.json({ ok: true, count: newRows.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Clear all notifications
router.delete('/', (_req, res) => {
  try {
    db.prepare('DELETE FROM requests').run();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Server-Sent Events for admin notifications
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const id = clientIdSeq++;
  clients.push({ id, res });
  req.on('close', () => {
    const idx = clients.findIndex(c => c.id === id);
    if (idx >= 0) clients.splice(idx, 1);
  });
  res.write('event: ping\n');
  res.write('data: connected\n\n');
});

export default router;


