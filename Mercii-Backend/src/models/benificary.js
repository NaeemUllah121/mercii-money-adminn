'use strict';

const { Model } = require('sequelize');
const { MODELS } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class benificary extends Model {
    static associate(models) {
      // Define association with User model
      this.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'benificary'
      });
    }
  }

  benificary.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: MODELS.USER,
        key: 'id'
      }
    },
    type: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    iban: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    bankName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(255),
      defaultValue: 'Pakistan'
    },
    address1: {
      type: DataTypes.STRING(255),
    },
    
    city: {
      type: DataTypes.STRING(255),
    },
    deliveryMethod: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    // Persist last used source of fund and sending reason from transactions
    sourceOfFund: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sendingReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contactNo: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    pickupLocation: {
      type: DataTypes.TEXT,
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
    },
    USIbeneficiaryId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Additional details map for contact information and relation
    additionalDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        contactNumber: null,
        relation: null
      }
    },
  }, {
    sequelize,
    modelName: MODELS.BENIFICARY,
  });

  return benificary;
};