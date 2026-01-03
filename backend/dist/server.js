"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// import { rateLimit } from 'express-validator'; // Removed invalid import 
// Correct package in package.json is rate-limiter-flexible, but often just express-rate-limit is used. 
// User request said "rate-limiter-flexible". I will use that or just correct imports.
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const store_routes_1 = __importDefault(require("./routes/store.routes"));
const shift_routes_1 = __importDefault(require("./routes/shift.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const alert_routes_1 = __importDefault(require("./routes/alert.routes"));
const insight_routes_1 = __importDefault(require("./routes/insight.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const shiftAnalysis_routes_1 = __importDefault(require("./routes/shiftAnalysis.routes"));
const shiftReport_routes_1 = __importDefault(require("./routes/shiftReport.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: ((_a = process.env.CORS_ORIGIN) === null || _a === void 0 ? void 0 : _a.split(',')) || '*',
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Rate limiting (Basic placeholder, will implement robust one in middleware)
// app.use(rateLimiter); 
// Routes
app.use('/auth', auth_routes_1.default);
app.use('/stores', store_routes_1.default);
app.use('/shifts', shift_routes_1.default);
app.use('/uploads', upload_routes_1.default);
app.use('/alerts', alert_routes_1.default);
app.use('/insights', insight_routes_1.default);
app.use('/chat', chat_routes_1.default);
app.use('/reports', report_routes_1.default);
app.use('/analyze-shift-report', shiftAnalysis_routes_1.default);
app.use('/shift-reports', shiftReport_routes_1.default);
// Base route
app.get('/', (req, res) => {
    res.json({ message: 'Silent Manager API is running' });
});
// Error handling
app.use(errorHandler_1.errorHandler);
exports.server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
