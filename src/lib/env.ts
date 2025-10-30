import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_B64: z.string().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string(),
  GOOGLE_SHEETS_SPREADSHEET_ID_1: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default(''),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  FROM_EMAIL: z.string().optional()
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}


