"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const EnvSchema = zod_1.z.object({
    PORT: zod_1.z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS: zod_1.z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_JSON: zod_1.z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_JSON_B64: zod_1.z.string().optional(),
    GOOGLE_SHEETS_SPREADSHEET_ID: zod_1.z.string(),
    ALLOWED_ORIGINS: zod_1.z.string().default(''),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_SECURE: zod_1.z
        .union([zod_1.z.literal('true'), zod_1.z.literal('false')])
        .optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    ADMIN_EMAIL: zod_1.z.string().optional(),
    FROM_EMAIL: zod_1.z.string().optional()
});
function loadEnv() {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
        // eslint-disable-next-line no-console
        console.error('Invalid environment variables:', parsed.error.flatten());
        process.exit(1);
    }
    return parsed.data;
}
