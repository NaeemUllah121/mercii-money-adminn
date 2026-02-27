'use strict';
const { Model } = require('sequelize');
const { MODELS } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
    class Fcm extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            this.belongsTo(models[MODELS.USER], {
                as: 'fcmToken',
                onDelete: 'cascade',
                onUpdate: 'cascade',
                foreignKey: 'userId',
            });
        }
    }
    Fcm.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            fcm: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            uniqueId: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
        },
        {
            sequelize,
            modelName: MODELS.FCM,
        },
    );
    return Fcm;
};
