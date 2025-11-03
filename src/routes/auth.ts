import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getSheetsClient, readRange, writeRange } from '../lib/sheets';
import { loadEnv } from '../lib/env';

const router = Router();

const DOMAIN = '@srec.ac.in';
const USERS_SHEET = 'Users';
const ROLES_SHEET = 'Roles';

function getEditableSpreadsheetId(): string {
  const env = loadEnv();
  return (
    env.GOOGLE_SHEETS_SPREADSHEET_ID_EDITABLE ||
    env.GOOGLE_SHEETS_SPREADSHEET_ID_READONLY ||
    (env.GOOGLE_SHEETS_SPREADSHEET_ID as string)
  );
}

async function ensureSheetExistsAuth(sheetName: string): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEditableSpreadsheetId();
  const ss = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (ss.data.sheets || []).some(s => s.properties?.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
    });
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function ensureUsersHeader() {
  const sheets = getSheetsClient();
  const spreadsheetId = getEditableSpreadsheetId();
  await ensureSheetExistsAuth(USERS_SHEET);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${USERS_SHEET}'!A1:C1`
  });
  const header = (res.data.values as string[][])?.[0] || [];
  if ((header[0] || '').toLowerCase() !== 'email' || (header[1] || '').toLowerCase() !== 'passwordhash' || (header[2] || '').toLowerCase() !== 'role') {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${USERS_SHEET}'!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[ 'email', 'passwordHash', 'role' ]] }
    });
  }
}

async function getAllUsers(): Promise<Array<{ email: string; passwordHash: string; role: string }>> {
  await ensureUsersHeader();
  const sheets = getSheetsClient();
  const spreadsheetId = getEditableSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${USERS_SHEET}'!A2:C2000`
  });
  const rows = (res.data.values as string[][]) || [];
  const users: Array<{ email: string; passwordHash: string; role: string }> = [];
  for (const r of rows) {
    const [email, passwordHash, role] = [r[0] || '', r[1] || '', r[2] || ''];
    if (email) users.push({ email: String(email).toLowerCase(), passwordHash: String(passwordHash), role: role || 'Student' });
  }
  return users;
}

async function ensureRolesHeader() {
  const sheets = getSheetsClient();
  const spreadsheetId = getEditableSpreadsheetId();
  await ensureSheetExistsAuth(ROLES_SHEET);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${ROLES_SHEET}'!A1:C1`
  });
  const header = (res.data.values as string[][])?.[0] || [];
  const ok = (header[0] || '').toLowerCase() === 'admin' && (header[1] || '').toLowerCase() === 'faculty' && (header[2] || '').toLowerCase() === 'student';
  if (!ok) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${ROLES_SHEET}'!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[ 'Admin', 'Faculty', 'Student' ]] }
    });
  }
}

type RolesColumns = { admin: string[]; faculty: string[]; student: string[] };
let rolesCache: { value: RolesColumns; expiresAt: number } | null = null;
let rolesLoadPromise: Promise<RolesColumns> | null = null;

async function readRolesFresh(): Promise<RolesColumns> {
  await ensureRolesHeader();
  const sheets = getSheetsClient();
  const spreadsheetId = getEditableSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${ROLES_SHEET}'!A2:C2000`
  });
  const rows = (res.data.values as string[][]) || [];
  const admin: string[] = []; const faculty: string[] = []; const student: string[] = [];
  for (const r of rows) {
    if (r[0]) admin.push(String(r[0]).toLowerCase());
    if (r[1]) faculty.push(String(r[1]).toLowerCase());
    if (r[2]) student.push(String(r[2]).toLowerCase());
  }
  return { admin, faculty, student };
}

async function readRolesCached(): Promise<RolesColumns> {
  const now = Date.now();
  if (rolesCache && rolesCache.expiresAt > now) return rolesCache.value;
  if (!rolesLoadPromise) {
    rolesLoadPromise = readRolesFresh()
      .then((v) => {
        rolesCache = { value: v, expiresAt: now + 5 * 60 * 1000 };
        return v;
      })
      .finally(() => { rolesLoadPromise = null; });
  }
  return rolesLoadPromise;
}

async function writeRoles(columns: RolesColumns) {
  await ensureRolesHeader();
  const maxLen = Math.max(columns.admin.length, columns.faculty.length, columns.student.length);
  const values: string[][] = [];
  for (let i = 0; i < maxLen; i++) {
    values.push([
      columns.admin[i] || '',
      columns.faculty[i] || '',
      columns.student[i] || ''
    ]);
  }
  const sheets = getSheetsClient();
  const spreadsheetId = getEditableSpreadsheetId();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${ROLES_SHEET}'!A2:C2000`,
    valueInputOption: 'RAW',
    requestBody: { values: values.length ? values : [['','','']] }
  });
  rolesCache = { value: columns, expiresAt: Date.now() + 5 * 60 * 1000 };
}

async function seedRoles() {
  try {
    await ensureRolesHeader();
    const roles = await readRolesCached();
    const addIfMissing = (arr: string[], email: string) => { if (!arr.includes(email)) arr.push(email); };
    // Seed requested assignments
    addIfMissing(roles.admin, 'eswar.2411018@srec.ac.in');
    addIfMissing(roles.faculty, 'gomathisankari.v@srec.ac.in');
    // Ensure uniqueness across columns: if admin contains email, remove from others, etc.
    const unique = {
      admin: new Set(roles.admin),
      faculty: new Set(roles.faculty),
      student: new Set(roles.student)
    };
    // Remove overlaps with precedence: Admin > Faculty > Student
    for (const e of Array.from(unique.admin)) { unique.faculty.delete(e); unique.student.delete(e); }
    for (const e of Array.from(unique.faculty)) { unique.student.delete(e); }
    await writeRoles({
      admin: Array.from(unique.admin),
      faculty: Array.from(unique.faculty),
      student: Array.from(unique.student)
    });
  } catch {}
}

async function getRoleForEmail(email: string): Promise<string | null> {
  const roles = await readRolesCached();
  const e = email.toLowerCase();
  if (roles.admin.includes(e)) return 'Admin';
  if (roles.faculty.includes(e)) return 'Faculty';
  if (roles.student.includes(e)) return 'Student';
  return null;
}

const SignupSchema = z.object({
  email: z.string().email().refine(v => v.toLowerCase().endsWith(DOMAIN), `Email must end with ${DOMAIN}`),
  password: z.string().min(8)
});

const LoginSchema = z.object({
  email: z.string().email().refine(v => v.toLowerCase().endsWith(DOMAIN), `Email must end with ${DOMAIN}`),
  password: z.string().min(1)
});

const ResetSchema = z.object({
  email: z.string().email().refine(v => v.toLowerCase().endsWith(DOMAIN), `Email must end with ${DOMAIN}`),
  newPassword: z.string().min(8)
});

router.post('/signup', async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = parsed.data.email.toLowerCase();
  const passwordHash = sha256(parsed.data.password);
  try {
    const users = await getAllUsers();
    if (users.some(u => u.email === email)) return res.status(400).json({ error: 'Account already exists' });
    const roleOverride = await getRoleForEmail(email);
    const sheets = getSheetsClient();
    await ensureUsersHeader();
    const spreadsheetId = getEditableSpreadsheetId();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${USERS_SHEET}'!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[ email, passwordHash, roleOverride || 'Student' ]] }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = parsed.data.email.toLowerCase();
  const passwordHash = sha256(parsed.data.password);
  try {
    const users = await getAllUsers();
    const user = users.find(u => u.email === email);
    if (!user || user.passwordHash !== passwordHash) return res.status(401).json({ error: 'Invalid email or password' });
    const roleOverride = await getRoleForEmail(email);
    const role = roleOverride || user.role || 'Student';
    res.json({ ok: true, user: { email: user.email, role } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/reset', async (req, res) => {
  const parsed = ResetSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = parsed.data.email.toLowerCase();
  const newHash = sha256(parsed.data.newPassword);
  try {
    await seedRoles();
    await ensureUsersHeader();
    const sheets = getSheetsClient();
    const spreadsheetId = getEditableSpreadsheetId();
    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${USERS_SHEET}'!A2:C2000`
    });
    const all = (valuesRes.data.values as string[][]) || [];
    let targetRowIndex = -1; // 0-based within A2:C2000
    for (let i = 0; i < all.length; i++) {
      if ((all[i][0] || '').toString().toLowerCase() === email) { targetRowIndex = i; break; }
    }
    if (targetRowIndex === -1) return res.status(404).json({ error: 'Account not found' });
    const absoluteRow = 2 + targetRowIndex; // actual row number in sheet
    const currentRole = all[targetRowIndex][2] || 'Student';
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${USERS_SHEET}'!A${absoluteRow}:C${absoluteRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[ email, newHash, currentRole ]] }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

// Seed roles once at startup, not per request
seedRoles().catch(() => {});
