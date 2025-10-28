// src/controllers/countriesController.js
const Country = require('../models/country');
const Metadata = require('../models/metadata');
const sequelize = require('../config/db');
const axios = require('axios');
const { Op } = require('sequelize');
const imageService = require('../services/imageService');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function refreshCountries(req, res) {
  try {
    const [countriesRes, exchangeRes] = await Promise.all([
      axios.get('https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies'),
      axios.get('https://open.er-api.com/v6/latest/USD')
    ]);

    const countriesRaw = countriesRes.data;
    const rates = exchangeRes.data.rates || {};
    const now = new Date().toISOString();

    await sequelize.transaction(async (t) => {
      for (const c of countriesRaw) {
        if (!c.name || !c.population) continue;

        const population = Number(c.population) || 0;
        const currency = (c.currencies && c.currencies[0] && c.currencies[0].code) || null;

        let exchange_rate = null;
        let estimated_gdp = null;

        if (!currency) {
          estimated_gdp = 0;
        } else if (!rates[currency]) {
          exchange_rate = null;
          estimated_gdp = null;
        } else {
          exchange_rate = rates[currency];
          const multiplier = randInt(1000, 2000);
          estimated_gdp = population * multiplier / exchange_rate;
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

        const existing = await Country.findOne({
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), c.name.toLowerCase()),
          transaction: t
        });

        if (existing) await existing.update(values, { transaction: t });
        else await Country.create(values, { transaction: t });
      }

      await Metadata.upsert({ meta_key: 'last_refreshed_at', meta_value: now }, { transaction: t });
    });

    try { await imageService.generateSummaryImage(); } catch { /* ignore */ }

    return res.status(200).json({ message: 'Refresh completed', last_refreshed_at: now });
  } catch (err) {
    console.error('refresh failed', err.message);
    return res.status(503).json({ error: 'External data source unavailable', details: err.message });
  }
}

async function listCountries(req, res) {
  const where = {};
  if (req.query.region) where.region = { [Op.like]: `%${req.query.region}%` };
  if (req.query.currency) where.currency_code = { [Op.like]: `%${req.query.currency}%` };
  let order = [['name', 'ASC']];
  if (req.query.sort === 'gdp_desc') order = [['estimated_gdp', 'DESC']];
  if (req.query.sort === 'gdp_asc') order = [['estimated_gdp', 'ASC']];
  const rows = await Country.findAll({ where, order });
  res.json(rows);
}

async function getCountry(req, res) {
  const name = req.params.name;
  const country = await Country.findOne({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.toLowerCase())
  });
  if (!country) return res.status(404).json({ error: 'Country not found' });
  res.json(country);
}

async function deleteCountry(req, res) {
  const name = req.params.name;
  const country = await Country.findOne({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.toLowerCase())
  });
  if (!country) return res.status(404).json({ error: 'Country not found' });
  await country.destroy();
  res.json({ message: `Country '${country.name}' deleted` });
}

async function getStatus(req, res) {
  const total = await Country.count();
  const meta = await Metadata.findOne({ where: { meta_key: 'last_refreshed_at' } });
  res.json({ total_countries: total, last_refreshed_at: meta ? meta.meta_value : null });
}

async function getImage(req, res) {
  const path = require('path');
  const fs = require('fs');
  const imgPath = path.join(process.env.CACHE_DIR || './cache', 'summary.png');
  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: 'Summary image not found' });
  res.sendFile(path.resolve(imgPath));
}

module.exports = { refreshCountries, listCountries, getCountry, deleteCountry, getStatus, getImage };
