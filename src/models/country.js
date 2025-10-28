const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');


const Country = sequelize.define('Country', {
id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
name: { type: DataTypes.STRING, allowNull: false },
capital: { type: DataTypes.STRING, allowNull: true },
region: { type: DataTypes.STRING, allowNull: true },
population: { type: DataTypes.BIGINT, allowNull: false },
currency_code: { type: DataTypes.STRING(10), allowNull: true },
exchange_rate: { type: DataTypes.DOUBLE, allowNull: true },
estimated_gdp: { type: DataTypes.DOUBLE, allowNull: true },
flag_url: { type: DataTypes.TEXT, allowNull: true },
last_refreshed_at: { type: DataTypes.DATE, allowNull: true }
}, {
tableName: 'countries',
timestamps: false,
});


module.exports = Country;