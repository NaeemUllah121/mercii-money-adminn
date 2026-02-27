const status = require('http-status');
const { APIresponse } = require('../utils/APIresponse');
const APIError = require('../utils/APIError');
const catchAsync = require('../utils/catchAsync');
const { compareRates } = require('../utils/comparision_banks');

// POST /rates/comparison
// Body: { amount, source_currency, dest_currency, dest_country, delivery_bank_name }
const getRatesComparison = catchAsync(async (req, res, next) => {
  try {
    const amount = Number(req.body.amount) || 100;
    const source_currency = (req.body.source_currency || 'GBP').toUpperCase();
    const dest_country = req.body.dest_country;
    const dest_currency = req.body.dest_currency ? String(req.body.dest_currency).toUpperCase() : undefined;
    const delivery_bank_name = req.body.delivery_bank_name || undefined;

    if (!dest_country) {
      return next(new APIError('Destination country is required', status.BAD_REQUEST));
    }

    const comparison = await compareRates({ amount, source_currency, dest_currency, dest_country, delivery_bank_name });

    return APIresponse(res, 'Rates comparison fetched successfully', comparison);
  } catch (err) {
    console.error('Rates comparison error:', err);
    // Do not leak low-level errors to client
    return APIresponse(res, 'Rates comparison fetched successfully', {
      USI: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      Wise: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      Revolut: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      Remitly: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      HBL: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
      WesternUnion: { rate: 'N/A', fee: 'N/A', deliveryTime: 'N/A' },
    });
  }
});

const getBankRates = catchAsync(async (req, res, next) => {
  try {
    const amount = Number(req.body.amount) || 100;
    const source_currency = (req.body.source_currency || 'GBP').toUpperCase();
    const dest_country = req.body.dest_country;
    const dest_currency = req.body.dest_currency ? String(req.body.dest_currency).toUpperCase() : undefined;

    if (!dest_country) {
      return next(new APIError('Destination country is required', status.BAD_REQUEST));
    }

    const comparison = await compareRates({ amount, source_currency, dest_currency, dest_country });

    const transformedData = {
      Mercii: {
        rate: comparison.USI?.rate !== 'N/A' ? comparison.USI.rate : null,
        fee: comparison.USI?.fee !== 'N/A' ? comparison.USI.fee : null
      },
      Remitly: {
        rate: comparison.Remitly?.rate !== 'N/A' ? comparison.Remitly.rate : null,
        fee: comparison.Remitly?.fee !== 'N/A' ? comparison.Remitly.fee : null
      },
      Wise: {
        rate: comparison.Wise?.rate !== 'N/A' ? comparison.Wise.rate : null,
        fee: comparison.Wise?.fee !== 'N/A' ? comparison.Wise.fee : null
      },
      Revolut: {
        rate: comparison.Revolut?.rate !== 'N/A' ? comparison.Revolut.rate : null,
        fee: comparison.Revolut?.fee !== 'N/A' ? comparison.Revolut.fee : null
      },
      'Western Union': {
        rate: comparison.WesternUnion?.rate !== 'N/A' ? comparison.WesternUnion.rate : null,
        fee: comparison.WesternUnion?.fee !== 'N/A' ? comparison.WesternUnion.fee : null
      },
      HBL: {
        rate: comparison.HBL?.rate !== 'N/A' ? comparison.HBL.rate : null,
        fee: comparison.HBL?.fee !== 'N/A' ? comparison.HBL.fee : null
      }
    };

    return APIresponse(res, 'Bank rates fetched successfully', transformedData);
  } catch (err) {
    console.error('getBankRates error:', err);
    return next(new APIError('Failed to fetch bank rates', status.INTERNAL_SERVER_ERROR));
  }
});

module.exports = { getRatesComparison, getBankRates };
