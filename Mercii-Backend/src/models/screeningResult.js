'use strict';
const { Model } = require('sequelize');
const { MODELS, TABLES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class ScreeningResult extends Model {
    static associate(models) {
      this.belongsTo(models[MODELS.USER], {
        as: 'user',
        foreignKey: 'userId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }

  ScreeningResult.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true, // allow null for non-remitter checks
      },
      isRemmiter: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      names: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      dob: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      fuzzy_search: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      totalHits: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      message: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      matched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      matchedRecord: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      rawResponse: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: MODELS.SCREENING_RESULT,
      tableName: TABLES.SCREENING_RESULTS,
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['isRemmiter'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return ScreeningResult;
};
