"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const env_1 = require("../lib/env");
const sheets_1 = require("../lib/sheets");
const router = (0, express_1.Router)();
router.get('/credentials', async (_req, res) => {
    const env = (0, env_1.loadEnv)();
    const result = {
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
            }
            catch (e) {
                result.canReadKey = false;
                return res.status(400).json({ ...result, error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON_B64' });
            }
        }
        else if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            result.authSource = 'inline-json';
            try {
                JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
                result.canReadKey = true;
            }
            catch (e) {
                result.canReadKey = false;
                return res.status(400).json({ ...result, error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON' });
            }
        }
        else {
            const keyPath = env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';
            result.authSource = `file:${keyPath}`;
            result.canReadKey = fs_1.default.existsSync(keyPath);
            if (!result.canReadKey) {
                return res.status(404).json({ ...result, error: `Key file not found at ${keyPath}` });
            }
        }
        // Try a lightweight Sheets call
        try {
            const sheets = (0, sheets_1.getSheetsClient)();
            await sheets.spreadsheets.values.get({
                spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
                range: 'A1:A1'
            });
            result.canAccessSheetsApi = true;
            return res.json(result);
        }
        catch (apiErr) {
            result.canAccessSheetsApi = false;
            return res.status(502).json({ ...result, error: apiErr.message });
        }
    }
    catch (err) {
        return res.status(500).json({ ...result, error: err.message });
    }
});
exports.default = router;
