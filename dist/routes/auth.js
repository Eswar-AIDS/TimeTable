"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const sheets_1 = require("../lib/sheets");
const router = (0, express_1.Router)();
const DOMAIN = '@srec.ac.in';
const USERS_SHEET = 'Users';
const ROLES_SHEET = 'Roles';
function sha256(input) {
    return (0, crypto_1.createHash)('sha256').update(input, 'utf8').digest('hex');
}
async function ensureUsersHeader() {
    const rows = await (0, sheets_1.readRange)({ sheetName: USERS_SHEET, rangeA1: 'A1:C1' });
    const header = rows[0] || [];
    if ((header[0] || '').toLowerCase() !== 'email' || (header[1] || '').toLowerCase() !== 'passwordhash' || (header[2] || '').toLowerCase() !== 'role') {
        await (0, sheets_1.writeRange)({ sheetName: USERS_SHEET, rangeA1: 'A1:C1' }, [['email', 'passwordHash', 'role']]);
    }
}
async function getAllUsers() {
    await ensureUsersHeader();
    const rows = await (0, sheets_1.readRange)({ sheetName: USERS_SHEET, rangeA1: 'A2:C2000' });
    const users = [];
    for (const r of rows) {
        const [email, passwordHash, role] = [r[0] || '', r[1] || '', r[2] || ''];
        if (email)
            users.push({ email: String(email).toLowerCase(), passwordHash: String(passwordHash), role: role || 'Student' });
    }
    return users;
}
async function ensureRolesHeader() {
    const rows = await (0, sheets_1.readRange)({ sheetName: ROLES_SHEET, rangeA1: 'A1:C1' });
    const header = rows[0] || [];
    if ((header[0] || '').toLowerCase() !== 'admin' || (header[1] || '').toLowerCase() !== 'faculty' || (header[2] || '').toLowerCase() !== 'student') {
        await (0, sheets_1.writeRange)({ sheetName: ROLES_SHEET, rangeA1: 'A1:C1' }, [['Admin', 'Faculty', 'Student']]);
    }
}
let rolesCache = null;
let rolesLoadPromise = null;
async function readRolesFresh() {
    await ensureRolesHeader();
    const rows = await (0, sheets_1.readRange)({ sheetName: ROLES_SHEET, rangeA1: 'A2:C2000' });
    const admin = [];
    const faculty = [];
    const student = [];
    for (const r of rows) {
        if (r[0])
            admin.push(String(r[0]).toLowerCase());
        if (r[1])
            faculty.push(String(r[1]).toLowerCase());
        if (r[2])
            student.push(String(r[2]).toLowerCase());
    }
    return { admin, faculty, student };
}
async function readRolesCached() {
    const now = Date.now();
    if (rolesCache && rolesCache.expiresAt > now)
        return rolesCache.value;
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
async function writeRoles(columns) {
    await ensureRolesHeader();
    const maxLen = Math.max(columns.admin.length, columns.faculty.length, columns.student.length);
    const values = [];
    for (let i = 0; i < maxLen; i++) {
        values.push([
            columns.admin[i] || '',
            columns.faculty[i] || '',
            columns.student[i] || ''
        ]);
    }
    await (0, sheets_1.writeRange)({ sheetName: ROLES_SHEET, rangeA1: 'A2:C2000' }, values.length ? values : [['', '', '']]);
    rolesCache = { value: columns, expiresAt: Date.now() + 5 * 60 * 1000 };
}
async function seedRoles() {
    try {
        await ensureRolesHeader();
        const roles = await readRolesCached();
        const addIfMissing = (arr, email) => { if (!arr.includes(email))
            arr.push(email); };
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
        for (const e of Array.from(unique.admin)) {
            unique.faculty.delete(e);
            unique.student.delete(e);
        }
        for (const e of Array.from(unique.faculty)) {
            unique.student.delete(e);
        }
        await writeRoles({
            admin: Array.from(unique.admin),
            faculty: Array.from(unique.faculty),
            student: Array.from(unique.student)
        });
    }
    catch { }
}
async function getRoleForEmail(email) {
    const roles = await readRolesCached();
    const e = email.toLowerCase();
    if (roles.admin.includes(e))
        return 'Admin';
    if (roles.faculty.includes(e))
        return 'Faculty';
    if (roles.student.includes(e))
        return 'Student';
    return null;
}
const SignupSchema = zod_1.z.object({
    email: zod_1.z.string().email().refine(v => v.toLowerCase().endsWith(DOMAIN), `Email must end with ${DOMAIN}`),
    password: zod_1.z.string().min(8)
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email().refine(v => v.toLowerCase().endsWith(DOMAIN), `Email must end with ${DOMAIN}`),
    password: zod_1.z.string().min(1)
});
const ResetSchema = zod_1.z.object({
    email: zod_1.z.string().email().refine(v => v.toLowerCase().endsWith(DOMAIN), `Email must end with ${DOMAIN}`),
    newPassword: zod_1.z.string().min(8)
});
router.post('/signup', async (req, res) => {
    const parsed = SignupSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const email = parsed.data.email.toLowerCase();
    const passwordHash = sha256(parsed.data.password);
    try {
        const users = await getAllUsers();
        if (users.some(u => u.email === email))
            return res.status(400).json({ error: 'Account already exists' });
        const roleOverride = await getRoleForEmail(email);
        const sheets = (0, sheets_1.getSheetsClient)();
        await ensureUsersHeader();
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: `'${USERS_SHEET}'!A1:C1`,
            valueInputOption: 'RAW',
            requestBody: { values: [[email, passwordHash, roleOverride || 'Student']] }
        });
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const email = parsed.data.email.toLowerCase();
    const passwordHash = sha256(parsed.data.password);
    try {
        const users = await getAllUsers();
        const user = users.find(u => u.email === email);
        if (!user || user.passwordHash !== passwordHash)
            return res.status(401).json({ error: 'Invalid email or password' });
        const roleOverride = await getRoleForEmail(email);
        const role = roleOverride || user.role || 'Student';
        res.json({ ok: true, user: { email: user.email, role } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/reset', async (req, res) => {
    const parsed = ResetSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const email = parsed.data.email.toLowerCase();
    const newHash = sha256(parsed.data.newPassword);
    try {
        await seedRoles();
        await ensureUsersHeader();
        const all = await (0, sheets_1.readRange)({ sheetName: USERS_SHEET, rangeA1: 'A2:C2000' });
        let targetRowIndex = -1; // 0-based within A2:C2000
        for (let i = 0; i < all.length; i++) {
            if ((all[i][0] || '').toString().toLowerCase() === email) {
                targetRowIndex = i;
                break;
            }
        }
        if (targetRowIndex === -1)
            return res.status(404).json({ error: 'Account not found' });
        const absoluteRow = 2 + targetRowIndex; // actual row number in sheet
        const currentRole = all[targetRowIndex][2] || 'Student';
        await (0, sheets_1.writeRange)({ sheetName: USERS_SHEET, rangeA1: `A${absoluteRow}:C${absoluteRow}` }, [[email, newHash, currentRole]]);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
// Seed roles once at startup, not per request
seedRoles().catch(() => { });
