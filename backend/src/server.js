const http = require('http');
const WebSocket = require('ws');

const app = require('./app');
const { env } = require('./config/env');

const server = http.createServer(app);

// ── WebSocket server for real-time proctoring alerts & telemetry (Section 3.2.4 / F.8, F.5) ──
const wss = new WebSocket.Server({ server, path: '/ws/proctor' });
const connectedClients = new Set();

wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log(`[WS] Client connected (total: ${connectedClients.size})`);

    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Proctora real-time stream active.' }));

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw.toString());
            // Broadcast proctoring alerts/telemetry to all admin listeners
            for (const client of connectedClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            }
        } catch (e) {
            console.error('[WS] Parse error:', e.message);
        }
    });

    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log(`[WS] Client disconnected (total: ${connectedClients.size})`);
    });

    ws.on('error', (err) => {
        console.error('[WS] Socket error:', err.message);
        connectedClients.delete(ws);
    });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = env.PORT || 3000;
server.listen(PORT, () => {
    console.log('=======================================================');
    console.log('  Proctora Real-Time Online Examination System Backend  ');
    console.log('=======================================================');
    console.log(`HTTP  → http://localhost:${PORT}/api`);
    console.log(`WS    → ws://localhost:${PORT}/ws/proctor`);
    console.log(`Mode  → ${env.NODE_ENV}`);
});

module.exports = { server, wss };
