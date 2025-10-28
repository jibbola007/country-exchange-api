const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const Country = require('../models/country');
const Metadata = require('../models/metadata');

const CACHE_DIR = process.env.CACHE_DIR || './cache';


async function generateSummaryImage() {
// gather data
const total = await Country.count();
const top5 = await Country.findAll({
where: { estimated_gdp: { [require('sequelize').Op.ne]: null } },
order: [['estimated_gdp', 'DESC']],
limit: 5
});
const meta = await Metadata.findOne({ where: { meta_key: 'last_refreshed_at' } });
const ts = meta ? meta.meta_value : new Date().toISOString();


if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
const outPath = path.join(CACHE_DIR, 'summary.png');


const width = 1200, height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');


// background
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, width, height);


ctx.fillStyle = '#000000';
ctx.font = 'bold 36px Arial';
ctx.fillText('Countries Summary', 40, 60);


ctx.font = '24px Arial';
ctx.fillText(`Total countries: ${total}`, 40, 110);
ctx.fillText(`Last refresh: ${ts}`, 40, 150);


ctx.font = '22px Arial';
ctx.fillText('Top 5 by estimated GDP:', 40, 200);


top5.forEach((c, i) => {
const text = `${i + 1}. ${c.name} — ${Number(c.estimated_gdp).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
ctx.fillText(text, 60, 240 + i * 32);
});


const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);
return outPath;
}


module.exports = { generateSummaryImage };