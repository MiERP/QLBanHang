import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { errorMiddleware } from './lib/http.js';
import { masterDataRouter } from './routes/masterData.js';
import { productsRouter } from './routes/products.js';
import { customersRouter } from './routes/customers.js';
import { staffRouter } from './routes/staff.js';
import { ordersRouter } from './routes/orders.js';
import { inventoryRouter } from './routes/inventory.js';
import { branchLoansRouter } from './routes/branchLoans.js';
import { deliveryRouter } from './routes/delivery.js';
import { dvgtRouter } from './routes/dvgt.js';
import { financeRouter } from './routes/finance.js';
import { kpiRouter } from './routes/kpi.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();
const port = Number(process.env.PORT || 4325);

getDb();

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'QAROMI ERP API', time: new Date().toISOString() });
});

const apiRouters = [
  masterDataRouter(),
  productsRouter(),
  customersRouter(),
  staffRouter(),
  ordersRouter(),
  inventoryRouter(),
  branchLoansRouter(),
  deliveryRouter(),
  dvgtRouter(),
  financeRouter(),
  kpiRouter(),
  dashboardRouter(),
];

for (const router of apiRouters) {
  app.use('/api', router);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = [
  join(process.cwd(), 'apps', 'web', 'dist'),
  resolve(__dirname, '..', '..', 'web', 'dist'),
  resolve(__dirname, '..', '..', '..', 'apps', 'web', 'dist'),
].find((candidate) => existsSync(candidate));

if (webDist) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(webDist, 'index.html'));
  });
}

app.use(errorMiddleware);

app.listen(port, '127.0.0.1', () => {
  console.log(`[QAROMI ERP API] Server running at http://127.0.0.1:${port}`);
});
