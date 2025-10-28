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

sequelize.authenticate()
  .then(() => {
    console.log('✅ DB connected');
    app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ DB connection failed:', err.message);
  });
