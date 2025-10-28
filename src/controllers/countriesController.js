const Country = require('../models/country');
const Metadata = require('../models/metadata');
const sequelize = require('../config/db');
const { fetchCountries, fetchExchangeRates } = require('../services/fetchers');
const imageService = require('../services/imageService');
const { Op } = require('sequelize');

// helper to generate random integer between min and max
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ========== POST /countries/refresh ==========
async function refreshAll(req, res) {
  let countriesRaw, rates;
  try {
    [countriesRaw, rates] = await Promise.all([fetchCountries(), fetchExchangeRates()]);
  } catch (err) {
    const details = err.message.includes('restcountries')
      ? 'Could not fetch data from restcountries.com'
      : 'Could not fetch data from open.er-api.com';
    return res.status(503).json({ error: 'External data source unavailable', details });
  }

  const now = new Date().toISOString();

  try {
    await sequelize.transaction(async (t) => {
      for (const c of countriesRaw) {
        if (!c.name || !c.population) {
            console.warn(`Skipping invalid country record: ${c.name || 'Unnamed'} (missing required fields)`);
            continue;
        }
        
        const currency = (c.currencies && c.currencies.length)
          ? c.currencies[0].code
          : null;

        let exchange_rate = null;
        let estimated_gdp = null;
        const population = Number(c.population) || 0;

        if (!currency) {
          // If currency is missing
          estimated_gdp = 0;
        } else if (!rates[currency]) {
          // If currency not found in rates API
          exchange_rate = null;
          estimated_gdp = null;
        } else {
          // Compute estimated GDP
          exchange_rate = rates[currency];
          const multiplier = randInt(1000, 2000);
          estimated_gdp = population * multiplier / exchange_rate;
        }

        // Prepare object to insert/update
        const values = {
          name: c.name,
          capital: c.capital || null,
          region: c.region || null,
          population,
          currency_code: currency,
          exchange_rate,
          estimated_gdp,
          flag_url: c.flag || null,
          last_refreshed_at: now
        };

        // Check if country exists (case-insensitive)
        const existing = await Country.findOne({
          where: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('name')),
            c.name.toLowerCase()
          ),
          transaction: t
        });

        if (existing) {
          await existing.update(values, { transaction: t });
        } else {
          await Country.create(values, { transaction: t });
        }
      }

      // Update global last_refreshed_at
      await Metadata.upsert(
        { meta_key: 'last_refreshed_at', meta_value: now },
        { transaction: t }
      );
    });

    // After saving to DB, generate image
    await imageService.generateSummaryImage();

    return res.status(200).json({
      message: 'Refresh completed',
      last_refreshed_at: now
    });
  } catch (err) {
    console.error('refresh failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /countries ==========
async function listCountries(req, res) {
  const where = {};
  const { Op } = require('sequelize');
  if (req.query.region) {
    where.region = { [Op.like]: `%${req.query.region}%` };
  }  
  if (req.query.currency) {
    where.currency_code = { [Op.like]: `%${req.query.currency}%` };
  }
  
  let order = [['name', 'ASC']];
  if (req.query.sort === 'gdp_desc') order = [['estimated_gdp', 'DESC']];
  else if (req.query.sort === 'gdp_asc') order = [['estimated_gdp', 'ASC']];

  try {
    const rows = await Country.findAll({ where, order });
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /countries/:name ==========
async function getCountry(req, res) {
  const name = req.params.name;
  const country = await Country.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      name.toLowerCase()
    ),
  });

  if (!country)
    return res.status(404).json({ error: 'Country not found' });

  return res.json(country);
}

// ========== DELETE /countries/:name ==========
async function deleteCountry(req, res) {
  try {
    const name = req.params.name;
    const country = await Country.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        name.toLowerCase()
      ),
    });

    if (!country)
      return res.status(404).json({ error: 'Country not found' });

    await country.destroy();
    return res.json({ message: `Country '${country.name}' deleted successfully` });
  } catch (err) {
    console.error('deleteCountry failed', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /status ==========
async function getStatus(req, res) {
  try {
    const total = await Country.count();
    const meta = await Metadata.findOne({ where: { meta_key: 'last_refreshed_at' } });
    const last = meta ? meta.meta_value : null;
    return res.json({
      total_countries: total,
      last_refreshed_at: last
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /countries/image ==========
async function getImage(req, res) {
  const path = require('path');
  const fs = require('fs');
  const imgPath = path.join(process.env.CACHE_DIR || './cache', 'summary.png');

  if (!fs.existsSync(imgPath))
    return res.status(404).json({ error: 'Summary image not found' });

  return res.sendFile(path.resolve(imgPath));
}

module.exports = {
  refreshAll,
  listCountries,
  getCountry,
  deleteCountry,
  getStatus,
  getImage
};
