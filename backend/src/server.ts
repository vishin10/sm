import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// import { rateLimit } from 'express-validator'; // Removed invalid import 
// Correct package in package.json is rate-limiter-flexible, but often just express-rate-limit is used. 
// User request said "rate-limiter-flexible". I will use that or just correct imports.
import { errorHandler } from './middleware/errorHandler';
// Routes
import authRoutes from './routes/auth.routes';
import storeRoutes from './routes/store.routes';
import shiftRoutes from './routes/shift.routes';
import uploadRoutes from './routes/upload.routes';
import alertRoutes from './routes/alert.routes';
import insightRoutes from './routes/insight.routes';
import reportRoutes from './routes/report.routes';
import shiftAnalysisRoutes from './routes/shiftAnalysis.routes';
import shiftReportRoutes from './routes/shiftReport.routes';
import chatRoutes from './routes/chat.routes';
import { startConversationCleanupJob } from './jobs/conversationCleanup';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting (Basic placeholder, will implement robust one in middleware)
// app.use(rateLimiter); 

// Routes
app.use('/auth', authRoutes);
app.use('/stores', storeRoutes);
app.use('/shifts', shiftRoutes);
app.use('/uploads', uploadRoutes);
app.use('/alerts', alertRoutes);
app.use('/insights', insightRoutes);
app.use('/reports', reportRoutes);
app.use('/analyze-shift-report', shiftAnalysisRoutes);
app.use('/shift-reports', shiftReportRoutes);
app.use('/chat', chatRoutes);

// Base route
app.get('/', (req, res) => {
    res.json({ message: 'Silent Manager API is running' });
});

// Error handling
app.use(errorHandler);

export const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Start background jobs
    startConversationCleanupJob();
});
