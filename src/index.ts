import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import consumerRoutes from './routes/consumer.js';
import producerManagedRoutes from './routes/producerManaged.js';
import createSqlRoutes from './routes/createSql.js';
import createVmRoutes from './routes/createVm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple paths for .env file
const possibleEnvPaths = [
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  console.log('Trying to load .env from:', envPath);
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log('Environment variables loaded successfully from:', envPath);
    envLoaded = true;
    break;
  } else {
    console.log('Failed to load from:', envPath, result.error.message);
  }
}

if (!envLoaded) {
  console.warn('No .env file found, using system environment variables');
}

console.log('Final environment variables:');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('PORT:', process.env.PORT);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/consumer', consumerRoutes);
app.use('/api/producer-managed', producerManagedRoutes);
app.use('/api/create-sql', createSqlRoutes);
app.use('/api/create-vm', createVmRoutes);

app.get('/', (_req, res) => {
  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    }
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    res.send(`Hello World from new app! Credentials loaded successfully`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).send(`Error reading credentials: ${errorMessage}`);
  }
});

// Add a simple debug route
app.get('/debug', (_req, res) => {
  console.log('=== DEBUG ROUTE HIT ===');
  
  const debugResponse = {
    message: 'Debug route working',
    timestamp: new Date().toISOString(),
    server: 'psc-automation',
    version: '1.0.0'
  };
  
  // Set comprehensive response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Connection', 'close');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Convert response to string to get exact length
  const responseString = JSON.stringify(debugResponse);
  res.setHeader('Content-Length', Buffer.byteLength(responseString, 'utf8'));
  
  // Send response and explicitly end connection
  res.status(200).send(responseString);
  
  // Force end the response and close connection
  res.end();
  
  // Destroy the socket to ensure connection closure
  if (res.socket && !res.socket.destroyed) {
    res.socket.destroy();
  }
  
  console.log('Debug response sent and ended successfully');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Global process cleanup handlers
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
