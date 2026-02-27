'use strict';

const { Model } = require('sequelize');
const { TABLES, MODELS, ENUMS } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class transaction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define association with User model
      transaction.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      transaction.belongsTo(models.benificary, {
        foreignKey: 'benificaryId',
        as: 'benificary',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  }

  transaction.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: TABLES.USERS,
        key: 'id'
      },
      validate: {
        isUUID: {
          args: 4,
          msg: 'User ID must be a valid UUID'
        }
      }
    },
    benificaryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: TABLES.BENIFICARIES,
        key: 'id'
      },
      validate: {
        isUUID: {
          args: 4,
          msg: 'Benificary ID must be a valid UUID'
        }
      }
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    amountInPkr: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    usiPaymentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    sourceOfFund: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    refId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      validate: {
        // Only validate on create; legacy data may be UUID strings
        isValidFormat(value) {
          if (this.isNewRecord) {
            // Must be numeric only, length between 14 and 16
            const ok = /^\d{14,16}$/.test(value);
            if (!ok) {
              throw new Error('refId must be numeric only (digits) with length between 14 and 16');
            }
          }
        }
      }
    },
    sendingReason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Add these columns to your transactions table
    volumePaymentId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(ENUMS.PENDING, ENUMS.COMPLETED, ENUMS.FAILED, ENUMS.CANCLED, ENUMS.REFUNDED),
      defaultValue: ENUMS.PENDING
    },
    volumeStatus: {
      type: DataTypes.STRING,
      defaultValue: ENUMS.NOT_INITIATED
    },
    usiStatus: {
      type: DataTypes.STRING,
      defaultValue: ENUMS.NOT_INITIATED
    },
    volumeCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    usiCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    usiResponse: {
      type: DataTypes.JSON,
      allowNull: true
    },
    collection_point_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    collection_point: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    collection_point_address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    collection_point_city: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: MODELS.TRANSACTION,
    timestamps: true,

    // Indexes for better query performance
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['benificaryId']  
      },
      {
        fields: ['usiPaymentId']
      },
      {
        fields: ['volumePaymentId']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['amount']
      },
      {
        fields: ['refId']  // Index for refId; uniqueness enforced at DB level via migration
      }
    ],
  });

  // Utility to generate a numeric string of length between 14 and 16
  function generateRefId(len = 14) {
    const digits = '0123456789';
    // Ensure length is within 14..16
    const target = Math.min(Math.max(len, 14), 16);
    let out = '';
    for (let i = 0; i < target; i++) {
      const idx = Math.floor(Math.random() * digits.length);
      out += digits[idx];
    }
    return out;
  }

  // Ensure refId exists before validation
  transaction.addHook('beforeValidate', async (instance, options) => {
    if (!instance.refId) {
      instance.refId = generateRefId(14);
    }
  });

  // Ensure unique refId generation before creation
  transaction.addHook('beforeCreate', async (instance, options) => {
    if (!instance.refId) {
      // Retry loop to ensure uniqueness
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateRefId(14);
        // Check uniqueness
        const exists = await transaction.findOne({ where: { refId: candidate }, attributes: ['id'] });
        if (!exists) {
          instance.refId = candidate;
          break;
        }
      }
      // As a final fallback, append a timestamp fragment to ensure uniqueness
      if (!instance.refId) {
        // Keep numeric-only fallback within max 16 length
        const ts = Date.now().toString();
        const suffix = ts.slice(-4).replace(/\D/g, '');
        let base = generateRefId(12);
        let fallback = `${base}${suffix}`.replace(/\D/g, '');
        if (fallback.length > 16) fallback = fallback.slice(0, 16);
        if (fallback.length < 14) fallback = fallback.padEnd(14, '0');
        instance.refId = fallback;
      }
    }
  });

  return transaction;
};