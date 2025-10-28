// src/routes/countries.js
const express = require('express');
const router = express.Router();
const {
  refreshAll,
  listCountries,
  getCountry,
  deleteCountry,
  getStatus,
  getImage
} = require('../controllers/countriesController');
const { countryRules, handleValidation } = require('../utils/validators');
const { Country, sequelize } = require('../models');

// ✅ Main routes
router.post('/refresh', refreshAll);
router.get('/', listCountries);
router.get('/status', getStatus);
router.get('/image', getImage);
router.get('/:name', getCountry);
router.delete('/:name', deleteCountry);

// ✅ Optional manual country add (for testing validation)
router.post('/', countryRules, handleValidation, async (req, res) => {
  try {
    const { name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url } = req.body;

    const existing = await Country.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        name.toLowerCase()
      )
    });

    if (existing) {
      return res.status(400).json({
        error: 'Validation failed',
        details: { name: 'already exists' }
      });
    }

    const newCountry = await Country.create({
      name,
      capital,
      region,
      population,
      currency_code,
      exchange_rate,
      estimated_gdp,
      flag_url
    });

    res.status(201).json(newCountry);
  } catch (err) {
    console.error('Error adding manual country:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
