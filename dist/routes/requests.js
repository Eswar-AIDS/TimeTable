"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = __importDefault(require("../lib/db"));
const email_1 = require("../lib/email");
const sheets_1 = require("../lib/sheets");
const env_1 = require("../lib/env");
const router = (0, express_1.Router)();
// Simple in-memory SSE clients
const clients = [];
let clientIdSeq = 1;
const RequestSchema = zod_1.z.object({
    role: zod_1.z.literal('Faculty').default('Faculty'),
    name: zod_1.z.string().optional(),
    message: zod_1.z.string().min(3)
});
router.post('/', async (req, res) => {
    const parsed = RequestSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { role, name, message } = parsed.data;
    const stmt = db_1.default.prepare('INSERT INTO requests(role, name, message) VALUES (?, ?, ?)');
    const info = stmt.run(role, name || null, message);
    const payload = { id: info.lastInsertRowid, role, name: name || null, message };
    // notify SSE clients
    for (const c of clients) {
        try {
            c.res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
        catch { }
    }
    // fire-and-forget email to admin
    (0, email_1.sendAdminEmail)('New timetable change request', `Role: ${role}\nName: ${name || 'Unknown'}\nMessage: ${message}\nRequest ID: ${String(info.lastInsertRowid)}`).catch(() => { });
    res.json({ ok: true, id: info.lastInsertRowid });
});
router.get('/', (_req, res) => {
    const rows = db_1.default.prepare('SELECT * FROM requests ORDER BY created_at DESC').all();
    res.json({ rows });
});
// Export notifications to a 'Notifications' sheet (overwrites contents)
router.post('/export', async (_req, res) => {
    try {
        const rows = db_1.default.prepare('SELECT * FROM requests ORDER BY created_at ASC').all();
        const header = ['Timestamp', 'Email', 'Role', 'Message'];
        const values = [header];
        for (const r of rows) {
            values.push([
                String(r.created_at || ''),
                String(r.name || ''),
                String(r.role || ''),
                String(r.message || '')
            ]);
        }
        // Append without removing existing data. If sheet is empty, write header first, then append data rows.
        const sheets = (0, sheets_1.getSheetsClient)();
        const env = (0, env_1.loadEnv)();
        // Read existing values to determine how many rows are already saved
        let existingCount = 0;
        try {
            const existing = await sheets.spreadsheets.values.get({
                spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
                range: `'Notifications'!A:A`
            });
            existingCount = (existing.data.values?.length || 0);
        }
        catch { }
        // If sheet is empty, write header first
        if (existingCount === 0) {
            const lastCol = String.fromCharCode(65 + header.length - 1);
            await (0, sheets_1.writeRange)({ sheetName: 'Notifications', rangeA1: `A1:${lastCol}1` }, [header]);
        }
        // Determine how many data rows are already present (subtract header if present)
        const existingDataRows = Math.max(0, existingCount - 1);
        // If existing sheet rows exceed current DB rows (e.g., DB was cleared), append all current DB rows
        const baseline = existingDataRows > rows.length ? 0 : existingDataRows;
        const newRows = rows.slice(baseline).map((r) => [
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Clear all notifications
router.delete('/', (_req, res) => {
    try {
        db_1.default.prepare('DELETE FROM requests').run();
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
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
        if (idx >= 0)
            clients.splice(idx, 1);
    });
    res.write('event: ping\n');
    res.write('data: connected\n\n');
});
exports.default = router;
