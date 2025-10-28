require('dotenv').config();
const express = require('express');
const app = express();
const sequelize = require('./config/db');
const countriesRouter = require('./routes/countries');
const { getStatus } = require('./controllers/countriesController'); // ✅ import the status function

app.use(express.json());

// Register routes
app.use('/countries', countriesRouter);

// ✅ Root-level status route
app.get('/status', getStatus);

// Health check or root endpoint
app.get('/', (req, res) => {
  res.send('🌍 Country Exchange API running successfully!');
});

// Start server after DB connection test
const PORT = process.env.PORT || 3000;

console.log('🔍 Checking environment variables...');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASS:', process.env.DB_PASS ? '✅ [Password present]' : '❌ [Password missing]');


sequelize.authenticate()
  .then(() => {
    console.log('✅ DB connected');
    app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ DB connection failed:', err.message);
  });
