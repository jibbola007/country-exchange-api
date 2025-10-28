// src/models/metadata.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Metadata = sequelize.define('Metadata', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  meta_key: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  meta_value: { type: DataTypes.TEXT },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'metadata',
  timestamps: false
});

module.exports = Metadata;
