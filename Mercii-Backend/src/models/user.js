'use strict';
require('dotenv').config();
const { Model } = require('sequelize');
const { MODELS, ENUMS, TABLES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      this.hasMany(models[MODELS.FORGETPASSWORDTOKEN], {
        as: 'forgetPasswordTokens',
        foreignKey: 'userId',
        onDelete: 'cascade',
        onUpdate: 'cascade',
      });
      this.hasOne(models[MODELS.FCM], {
        as: 'fcmToken',
        foreignKey: 'userId',
        onDelete: 'cascade',
        onUpdate: 'cascade',
      });
      this.hasOne(models[MODELS.KYC_REQUEST], {
        as: 'kyc',
        foreignKey: 'userId',
        onDelete: 'cascade',
        onUpdate: 'cascade',
      });
      this.hasMany(models[MODELS.SCREENING_RESULT], {
        as: 'screeningResults',
        foreignKey: 'userId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      this.hasMany(models[MODELS.BENIFICARY], {
        as: 'benificaries',
        foreignKey: 'userId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      this.hasMany(models[MODELS.TRANSACTION], {
        as: 'transactions',
        foreignKey: 'userId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      this.hasMany(models[MODELS.MLRO_FLAG], {
        as: 'mlroFlags',
        foreignKey: 'userId',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
        validate: {
          notEmpty: true,
          isNumeric: false, // Allow + and country codes
        },
      },
      plan: {
        type: DataTypes.ENUM('not_initiated', 'plus', 'base'),
        allowNull: false,
        defaultValue: 'not_initiated',
      },
      isPhoneVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      fullName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
          isDate: true,
          isBefore: new Date().toISOString(), // Must be in the past
        },
      },
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      streetAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      passcode: {
        type: DataTypes.STRING(255),
        allowNull: true, // Will be set after phone verification
      },
      registrationStep: {
        type: DataTypes.ENUM(
          'phone_verification',
          'personal_details',
          'passcode_creation',
          'completed'
        ),
        defaultValue: 'phone_verification',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      remitoneCustomerId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
      },
      kycStatus: {
        type: DataTypes.ENUM('not_initiated', 'pending', 'verified', 'rejected'),
        defaultValue: 'not_initiated',
      },
      nationality: {
        type: DataTypes.STRING(255), // ISO country code
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(255), // ISO country code
        allowNull: true,
        defaultValue: 'GB', // Default to UK
      },
      transferLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 5000, // Default monthly cap is £5,000
      },
      usedLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0, // Default to 0, can be updated later
      },
      googleId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
      },
      authMethod: {
        type: DataTypes.STRING(50), // e.g., 'google', 'facebook', 'apple'
        allowNull: true,
      },
      socialId: {
        type: DataTypes.STRING(150), // Social provider's user ID
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: MODELS.USER,
      tableName: TABLES.USERS,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['phoneNumber'],
        },
        {
          unique: true,
          fields: ['email'],
        },
        {
          fields: ['registrationStep'],
        },
        {
          fields: ['isActive'],
        },
        {
          fields: ['authMethod'],
        },
        {
          fields: ['socialId'],
        },
      ],
    }
  );

  return User;
};
