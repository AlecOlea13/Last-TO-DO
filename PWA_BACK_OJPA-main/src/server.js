import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dns from 'node:dns';

import userRoutes from "./routes/user.routes.js";
import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';

// ✅ Fuerza DNS públicos + IPv4 first
dns.setServers(['1.1.1.1', '8.8.8.8']);
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => res.json({ ok: true, name: 'Alec Todo API' }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use("/api/users", userRoutes);
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Falta MONGO_URI en el .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4,
})
  .then(() => {
    console.log('✅ Conectado a mongoDB', mongoose.connection.name);
    app.listen(PORT, () => console.log(`Servidor ejecutandose por: ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Error conectado a mongoDB:', err?.message);
    console.error(err);
    process.exit(1);
  });


