'use strict';
const { Model } = require('sequelize');
const { MODELS } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class forgetPasswordToken extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models[MODELS.USER], {
        as: 'forgetPasswordTokens',
        onDelete: 'cascade',
        onUpdate: 'cascade',
        foreignKey: 'userId',
      });
    }
  }
  forgetPasswordToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      token: DataTypes.STRING,
      expiresIn: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: MODELS.FORGETPASSWORDTOKEN,
    },
  );
  return forgetPasswordToken;
};
