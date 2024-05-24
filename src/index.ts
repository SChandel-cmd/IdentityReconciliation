import express, { Request, Response } from 'express';
import { identifyHandler } from './identify';

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Define the identify endpoint
app.post('/identify', identifyHandler);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});