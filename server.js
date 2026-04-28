const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Remover header que expõe a tecnologia usada
app.disable('x-powered-by');

// Headers de segurança
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Health check endpoint — Railway e uptime monitors usam este endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Rota raiz serve o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`[server] Rodando na porta ${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
});

// ──────────────────────────────────────────────
// ANTI-HIBERNAÇÃO: self-ping a cada 4 minutos
// Evita que o Railway coloque o serviço em sleep
// ──────────────────────────────────────────────
const SELF_PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutos

function selfPing() {
  const url = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`
    : `http://localhost:${PORT}/health`;

  const client = url.startsWith('https') ? https : http;

  const req = client.get(url, (res) => {
    console.log(`[ping] Self-ping OK — status ${res.statusCode} — ${new Date().toISOString()}`);
  });

  req.on('error', (err) => {
    console.warn(`[ping] Self-ping falhou: ${err.message}`);
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.warn('[ping] Self-ping timeout (10s)');
  });
}

// Aguarda 30s após start antes do primeiro ping
setTimeout(() => {
  selfPing();
  setInterval(selfPing, SELF_PING_INTERVAL_MS);
}, 30 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM recebido, encerrando...');
  server.close(() => process.exit(0));
});
