// src/routes/countries.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/countriesController');
const { countryRules, handleValidation } = require('../utils/validators');

// Existing routes
router.post('/refresh', controller.refreshAll);
router.get('/', controller.listCountries);
router.get('/image', controller.getImage);
router.get('/status', controller.getStatus);
router.get('/:name', controller.getCountry);
router.delete('/:name', controller.deleteCountry);

// Optional: Manual country add (for testing validation)
router.post('/', countryRules, handleValidation, async (req, res) => {
  try {
    const { name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url } = req.body;
    const existing = await controller.Country.findOne({
      where: controller.sequelize.where(
        controller.sequelize.fn('LOWER', controller.sequelize.col('name')),
        name.toLowerCase()
      )
    });
    if (existing) return res.status(400).json({ error: 'Validation failed', details: { name: 'already exists' } });

    const newCountry = await controller.Country.create({
      name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url
    });
    res.status(201).json(newCountry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;