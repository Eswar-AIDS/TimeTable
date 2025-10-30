"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminEmail = sendAdminEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("./env");
const env = (0, env_1.loadEnv)();
let transporter = null;
function getTransporter() {
    if (transporter)
        return transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS)
        return null;
    transporter = nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === 'true',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
    return transporter;
}
async function sendAdminEmail(subject, message) {
    const tx = getTransporter();
    const to = env.ADMIN_EMAIL;
    const from = env.FROM_EMAIL || env.ADMIN_EMAIL || env.SMTP_USER || 'no-reply@example.com';
    if (!to) {
        // eslint-disable-next-line no-console
        console.warn('[email] ADMIN_EMAIL not set; skipping email notification');
        return;
    }
    if (!tx) {
        // eslint-disable-next-line no-console
        console.warn('[email] SMTP not configured (check SMTP_HOST/PORT/USER/PASS); skipping email notification');
        return;
    }
    try {
        await tx.sendMail({ to, from, subject, text: message });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to send admin email:', err);
    }
}
