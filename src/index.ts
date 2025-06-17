import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import producerRoutes from './routes/producer.js';
import consumerRoutes from './routes/consumer.js';
import producerManagedRoutes from './routes/producerManaged.js';

dotenv.config();

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
