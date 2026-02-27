const { Model } = require('sequelize');
const { MODELS } = require("../utils/constants")
module.exports = (sequelize, DataTypes) => {
  class KycRequest extends Model {
    static associate(models) {
      this.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  KycRequest.init(
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
      referenceId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      country: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('not_initiated', 'pending', 'verified', 'declined', 'error'),
        defaultValue: 'not_initiated',
      },
      overAllStatus: {
        type: DataTypes.ENUM('not_initiated', 'pending', 'verified'),
        defaultValue: 'not_initiated',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      documentType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      faceMatched: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      callbackPayload: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      AdverseMedia: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      AMLScreening: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      checkIndividual: {
        type: DataTypes.STRING,
        defaultValue: 'not_initiated',
      },
      checkIndividualResponse: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      postcode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: MODELS.KYC_REQUEST,
    }
  );

  return KycRequest;
};
