"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSheetsClient = getSheetsClient;
exports.readRange = readRange;
exports.writeRange = writeRange;
exports.clearRange = clearRange;
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("./env");
function getAuth() {
    const env = (0, env_1.loadEnv)();
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    // Prefer base64 JSON, then inline JSON, else key file
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON_B64) {
        try {
            const json = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_B64, 'base64').toString('utf8');
            const credentials = JSON.parse(json);
            const auth = new google_auth_library_1.GoogleAuth({ credentials, scopes });
            return auth;
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON_B64. Falling back to GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
        }
    }
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
            const auth = new google_auth_library_1.GoogleAuth({ credentials, scopes });
            return auth;
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Falling back to GOOGLE_APPLICATION_CREDENTIALS.');
        }
    }
    const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
    const auth = new google_auth_library_1.GoogleAuth({ keyFile, scopes });
    return auth;
}
function getSheetsClient() {
    const auth = getAuth();
    return googleapis_1.google.sheets({ version: 'v4', auth });
}
async function ensureSheetExists(sheetName) {
    const env = (0, env_1.loadEnv)();
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
async function readRange({ sheetName, rangeA1 }) {
    const env = (0, env_1.loadEnv)();
    const sheets = getSheetsClient();
    try {
        await ensureSheetExists(sheetName);
    }
    catch { }
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `'${sheetName}'!${rangeA1}`
    });
    return res.data.values || [];
}
async function writeRange({ sheetName, rangeA1 }, values) {
    const env = (0, env_1.loadEnv)();
    const sheets = getSheetsClient();
    await ensureSheetExists(sheetName);
    await sheets.spreadsheets.values.update({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `'${sheetName}'!${rangeA1}`,
        valueInputOption: 'RAW',
        requestBody: { values }
    });
}
async function clearRange({ sheetName, rangeA1 }) {
    const env = (0, env_1.loadEnv)();
    const sheets = getSheetsClient();
    await ensureSheetExists(sheetName);
    await sheets.spreadsheets.values.clear({
        spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `'${sheetName}'!${rangeA1}`
    });
}
