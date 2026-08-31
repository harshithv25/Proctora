require('dotenv').config();

const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');

// Import Module Routes
const authRoutes = require('./modules/auth/auth.routes');
const examConfigRoutes = require('./modules/exam-config/exam-config.routes');
const examDeliveryRoutes = require('./modules/exam-delivery/exam-delivery.routes');
const integrityMonitoringRoutes = require('./modules/integrity-monitoring/integrity-monitoring.routes');
const evaluationExportRoutes = require('./modules/evaluation-export/evaluation-export.routes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.ENVIRONMENT === 'development' || !process.env.ENVIRONMENT;
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

// Setup WebSocket Server for Real-Time Proctoring Alerts & Live Telemetry Streams (F.8, F.5)
const wss = new WebSocket.Server({ server, path: '/ws/proctor' });
const connectedClients = new Set();

wss.on('connection', (ws, req) => {
    connectedClients.add(ws);
    console.log(`[WebSocket]: New client connected (Total: ${connectedClients.size})`);

    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Real-time proctoring stream connected.' }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            // Broadcast real-time alerts or telemetry to all connected admin listeners
            for (const client of connectedClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error('[WebSocket Error]:', e);
        }
    });

    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log(`[WebSocket]: Client disconnected (Total: ${connectedClients.size})`);
    });
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Dynamic CORS Header configuration
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || clientOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Register Module Routes matching SRS & DFD Structure
app.use('/api/auth', authRoutes);
app.use('/api/config', examConfigRoutes);
app.use('/api/delivery', examDeliveryRoutes);
app.use('/api/monitoring', integrityMonitoringRoutes);
app.use('/api/evaluation', evaluationExportRoutes);

// System Health Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        system: 'Proctora Real-Time Online Examination System',
        modules: [
            'Authentication & Registration Module (F.1)',
            'Exam Configuration Module (F.3, F.11)',
            'Exam Delivery Module (F.2, F.3, F.10)',
            'Integrity Monitoring Module (F.4, F.5, F.6, F.8, F.12)',
            'Export & Evaluation Module (F.7, F.9)'
        ],
        mode: isDevelopment ? 'development' : 'production',
        diagnostics: isDevelopment ? { memory: process.memoryUsage(), platform: process.platform } : undefined
    });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`[Error Handler]: ${err.stack}`);
    const errorMessage = isDevelopment ? err.message : 'An internal server error occurred.';
    res.status(err.status || 500).json({
        error: errorMessage,
        details: isDevelopment ? err.stack : undefined
    });
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Proctora Real-Time Online Examination System Backend  `);
    console.log(`=======================================================`);
    console.log(`Server listening on: http://localhost:${PORT}`);
    console.log(`WebSocket endpoint on: ws://localhost:${PORT}/ws/proctor`);
});
