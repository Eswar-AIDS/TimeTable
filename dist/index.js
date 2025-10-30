"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./lib/env");
const timetable_1 = __importDefault(require("./routes/timetable"));
const health_1 = __importDefault(require("./routes/health"));
const requests_1 = __importDefault(require("./routes/requests"));
const auth_1 = __importDefault(require("./routes/auth"));
const env = (0, env_1.loadEnv)();
const app = (0, express_1.default)();
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
app.use((0, cors_1.default)({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express_1.default.json());
// Serve static frontend
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.use('/timetable', timetable_1.default);
app.use('/health', health_1.default);
app.use('/requests', requests_1.default);
app.use('/auth', auth_1.default);
const port = Number(env.PORT || 3000);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
});
