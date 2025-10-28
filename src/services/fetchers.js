const axios = require('axios');
require('dotenv').config();


const TIMEOUT = parseInt(process.env.EXTERNAL_TIMEOUT_MS || '10000', 10);


async function fetchCountries() {
const url = 'https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies';
const resp = await axios.get(url, { timeout: TIMEOUT });
if (resp.status !== 200) throw new Error('restcountries_failed');
return resp.data;
}


async function fetchExchangeRates() {
const url = 'https://open.er-api.com/v6/latest/USD';
const resp = await axios.get(url, { timeout: TIMEOUT });
if (resp.status !== 200) throw new Error('exchangerates_failed');
if (!resp.data || !resp.data.rates) throw new Error('exchangerates_invalid');
return resp.data.rates;
}


module.exports = { fetchCountries, fetchExchangeRates };