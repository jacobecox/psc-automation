import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import producerRoutes from './routes/producer.js';
import consumerRoutes from './routes/consumer.js';
import producerManagedRoutes from './routes/producerManaged.js';

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
app.use('/producer', producerRoutes);
app.use('/consumer', consumerRoutes);
app.use('/producerManaged', producerManagedRoutes);

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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
