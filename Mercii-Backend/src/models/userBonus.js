const { Model } = require('sequelize');
const { MODELS } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class UserBonus extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      this.belongsTo(models.transaction, { foreignKey: 'transactionId', as: 'transaction' });
    }
  }
  UserBonus.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      amount: {
        type: DataTypes.INTEGER, // PKR
        allowNull: false,
      },
      awardedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      anchorWindowId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bonusType: {
        type: DataTypes.ENUM('milestone1','milestone2','milestone3','milestone4','milestone8','milestone12'),
        allowNull: false,
      },
      transactionId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: MODELS.USER_BONUS,
      tableName: 'UserBonuses',
      timestamps: true,
    }
  );
  return UserBonus;
};
