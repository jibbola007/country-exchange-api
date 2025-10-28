// src/utils/validators.js
const { body, validationResult } = require('express-validator');

/**
 * Validation rules for manual country creation or update.
 * Not used by refreshAll (which validates internally), but useful for CRUD completeness.
 */
const countryRules = [
  body('name')
    .notEmpty().withMessage('is required')
    .isString().withMessage('must be a string'),
  body('population')
    .notEmpty().withMessage('is required')
    .isNumeric().withMessage('must be a number'),
  body('currency_code')
    .notEmpty().withMessage('is required')
    .isString().withMessage('must be a string')
];

/**
 * Middleware to handle validation errors consistently.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = {};
    errors.array().forEach(e => {
      details[e.param] = e.msg;
    });
    return res.status(400).json({
      error: 'Validation failed',
      details
    });
  }
  next();
}

module.exports = { countryRules, handleValidation };
