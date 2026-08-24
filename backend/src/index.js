require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.ENVIRONMENT === 'development';
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', clientOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        mode: process.env.ENVIRONMENT,
        diagnostics: isDevelopment ? { memory: process.memoryUsage(), platform: process.platform } : undefined
    });
});

app.use((err, req, res, next) => {
    console.error(`[Error Handler]: ${err.stack}`);

    const errorMessage = isDevelopment ? err.message : 'A generic internal server error occurred.';
    const errorDetails = isDevelopment ? err.stack : undefined;

    res.status(err.status || 500).json({
        error: errorMessage,
        details: errorDetails
    });
});

app.listen(PORT, () => {
    console.log(`Proctora Backend Operating Successfully!`);
    console.log(`Target Environment: [ ${process.env.ENVIRONMENT.toUpperCase()} ]`);
    console.log(`Listening on Port: http://localhost:${PORT}`);
});
