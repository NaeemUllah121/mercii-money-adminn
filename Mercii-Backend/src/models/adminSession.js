'use strict';
const { Model } = require('sequelize');
const { MODELS, TABLES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class AdminSession extends Model {
    static associate(models) {
      this.belongsTo(models[MODELS.ADMIN_USER], {
        as: 'adminUser',
        foreignKey: 'adminUserId',
        onDelete: 'cascade',
        onUpdate: 'cascade',
      });
    }

    static async createSession({
      adminUserId,
      ipAddress,
      userAgent,
      sessionToken,
      expiresAt
    }) {
      return await this.create({
        adminUserId,
        ipAddress,
        userAgent,
        sessionToken,
        expiresAt
      });
    }

    isExpired() {
      return new Date() > this.expiresAt;
    }

    async extendSession(hours = 8) {
      this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      await this.save();
    }
  }

  AdminSession.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      adminUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: TABLES.ADMIN_USERS,
          key: 'id'
        }
      },
      sessionToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      ipAddress: {
        type: DataTypes.INET,
        allowNull: false
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      lastActivityAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      mfaVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      logoutReason: {
        type: DataTypes.ENUM('manual', 'timeout', 'forced', 'security'),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: MODELS.ADMIN_SESSION,
      tableName: TABLES.ADMIN_SESSIONS,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['sessionToken']
        },
        {
          fields: ['adminUserId']
        },
        {
          fields: ['isActive']
        },
        {
          fields: ['expiresAt']
        },
        {
          fields: ['ipAddress']
        }
      ]
    }
  );

  return AdminSession;
};
