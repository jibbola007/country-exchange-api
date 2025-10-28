// src/controllers/countriesController.js

const Country = require('../models/country');
const Metadata = require('../models/metadata');
const sequelize = require('../config/db');
const imageService = require('../services/imageService');
const { Op } = require('sequelize');
const axios = require('axios');

// optional helpers (if you have a services/fetchers module)
// const { fetchCountries, fetchExchangeRates } = require('../services/fetchers');

// axios defaults
axios.defaults.timeout = 30000; // 30s timeout

// helper to generate random integer between min and max
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fetch helper: try to use fetchers service if available,
 * otherwise use axios directly.
 */
async function _fetchCountries() {
  // If you have a fetchers service, prefer it:
  try {
    // eslint-disable-next-line global-require
    const fetchers = require('../services/fetchers');
    if (fetchers && typeof fetchers.fetchCountries === 'function') {
      return await fetchers.fetchCountries();
    }
  } catch (e) {
    // no-op: fall back to axios
  }

  const res = await axios.get('https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies');
  return res.data;
}

async function _fetchExchangeRates() {
  try {
    const fetchers = require('../services/fetchers');
    if (fetchers && typeof fetchers.fetchExchangeRates === 'function') {
      return await fetchers.fetchExchangeRates();
    }
  } catch (e) {
    // fall back
  }

  const res = await axios.get('https://open.er-api.com/v6/latest/USD');
  // API format: { result: 'success', rates: { USD: 1, NGN: 1600, ... } } or similar
  // normalize to object of rates
  if (res.data && res.data.rates) return res.data.rates;
  // some APIs embed rates at top-level; otherwise return an empty object
  return {};
}

/**
 * POST /countries/refresh
 */
async function refreshCountries(req, res) {
  let countriesRaw;
  let rates;

  try {
    // parallel fetch
    [countriesRaw, rates] = await Promise.all([_fetchCountries(), _fetchExchangeRates()]);
  } catch (err) {
    console.error('refresh failed (fetch)', err && err.message ? err.message : err);
    return res.status(503).json({
      error: 'External data source unavailable',
      details: err && err.message ? err.message : 'Could not fetch data from external API'
    });
  }

  if (!Array.isArray(countriesRaw)) {
    console.error('refresh failed: countries response not array', countriesRaw);
    return res.status(503).json({
      error: 'External data source unavailable',
      details: 'Invalid countries data received'
    });
  }

  const now = new Date().toISOString();

  try {
    // single transaction for the whole refresh (per spec)
    await sequelize.transaction(async (t) => {
      // iterate sequentially (keeps DB safe); could be optimized in batches if needed
      for (const c of countriesRaw) {
        // validation: name and population required
        if (!c || !c.name || (c.population === undefined || c.population === null)) {
          console.warn(`Skipping invalid country record: ${c && c.name ? c.name : 'Unnamed'} (missing required fields)`);
          continue;
        }

        const population = Number(c.population) || 0;
        const currency = (Array.isArray(c.currencies) && c.currencies.length > 0 && c.currencies[0] && c.currencies[0].code)
          ? c.currencies[0].code
          : null;

        let exchange_rate = null;
        let estimated_gdp = null;

        if (!currency) {
          // currencies array empty => per spec
          exchange_rate = null;
          estimated_gdp = 0;
        } else if (!rates || typeof rates[currency] === 'undefined') {
          // currency code not found in rates API => per spec
          exchange_rate = null;
          estimated_gdp = null;
        } else {
          exchange_rate = Number(rates[currency]);
          // guard: avoid division by zero
          if (!exchange_rate || exchange_rate === 0) {
            estimated_gdp = null;
          } else {
            const multiplier = randInt(1000, 2000);
            estimated_gdp = population * multiplier / exchange_rate;
          }
        }

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

        // upsert logic: find by name case-insensitive
        const existing = await Country.findOne({
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), c.name.toLowerCase()),
          transaction: t
        });

        if (existing) {
          await existing.update(values, { transaction: t });
        } else {
          await Country.create(values, { transaction: t });
        }
      }

      // update global metadata
      await Metadata.upsert({ meta_key: 'last_refreshed_at', meta_value: now }, { transaction: t });
    });

    // generate summary image (may throw — that's okay we catch below)
    try {
      await imageService.generateSummaryImage();
    } catch (imgErr) {
      console.warn('Summary image generation failed:', imgErr && imgErr.message ? imgErr.message : imgErr);
      // do not fail the entire request if image generation fails — still return success per spec
    }

    return res.status(200).json({ message: 'Refresh completed', last_refreshed_at: now });
  } catch (err) {
    console.error('refresh failed (db)', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /countries ==========
async function listCountries(req, res) {
  const where = {};
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
    console.error('listCountries failed', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /countries/:name ==========
async function getCountry(req, res) {
  const name = req.params.name;
  try {
    const country = await Country.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.toLowerCase()),
    });

    if (!country) return res.status(404).json({ error: 'Country not found' });
    return res.json(country);
  } catch (err) {
    console.error('getCountry failed', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== DELETE /countries/:name ==========
async function deleteCountry(req, res) {
  try {
    const name = req.params.name;
    const country = await Country.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.toLowerCase()),
    });

    if (!country) return res.status(404).json({ error: 'Country not found' });

    await country.destroy();
    return res.json({ message: `Country '${country.name}' deleted successfully` });
  } catch (err) {
    console.error('deleteCountry failed', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /status ==========
async function getStatus(req, res) {
  try {
    const total = await Country.count();
    const meta = await Metadata.findOne({ where: { meta_key: 'last_refreshed_at' } });
    const last = meta ? meta.meta_value : null;
    return res.json({ total_countries: total, last_refreshed_at: last });
  } catch (err) {
    console.error('getStatus failed', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ========== GET /countries/image ==========
async function getImage(req, res) {
  const path = require('path');
  const fs = require('fs');
  const imgPath = path.join(process.env.CACHE_DIR || './cache', 'summary.png');

  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: 'Summary image not found' });

  return res.sendFile(path.resolve(imgPath));
}

module.exports = {
  refreshCountries, // matches typical controller usage from routes
  listCountries,
  getCountry,
  deleteCountry,
  getStatus,
  getImage
};
