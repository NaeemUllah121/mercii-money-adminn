'use strict';
const { Model } = require('sequelize');
const { MODELS, TABLES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      this.belongsTo(models[MODELS.ADMIN_USER], {
        as: 'adminUser',
        foreignKey: 'adminUserId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      this.belongsTo(models[MODELS.USER], {
        as: 'targetUser',
        foreignKey: 'targetUserId',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }

    static async logAction({
      adminUserId,
      action,
      resource,
      resourceId,
      targetUserId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      metadata = {}
    }) {
      return await this.create({
        adminUserId,
        action,
        resource,
        resourceId,
        targetUserId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
      });
    }

    get parsedOldValues() {
      return this.oldValues ? JSON.parse(this.oldValues) : null;
    }

    get parsedNewValues() {
      return this.newValues ? JSON.parse(this.newValues) : null;
    }

    get parsedMetadata() {
      return this.metadata ? JSON.parse(this.metadata) : null;
    }
  }

  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      adminUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: TABLES.ADMIN_USERS,
          key: 'id'
        }
      },
      action: {
        type: DataTypes.ENUM(
          'CREATE', 'READ', 'UPDATE', 'DELETE',
          'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
          'SUSPEND_CUSTOMER', 'UNSUSPEND_CUSTOMER',
          'APPROVE_MLRO', 'REJECT_MLRO', 'HOLD_MLRO',
          'REFUND_TRANSACTION', 'CANCEL_TRANSACTION',
          'RESEND_KYC', 'ADJUST_LIMITS',
          'EXPORT_DATA', 'VIEW_PII', 'MANAGE_ADMIN',
          'SYSTEM_CHANGE', 'SECURITY_ALERT'
        ),
        allowNull: false
      },
      resource: {
        type: DataTypes.ENUM(
          'USER', 'TRANSACTION', 'BENEFICIARY', 'KYC',
          'MLRO_FLAG', 'ADMIN_USER', 'SYSTEM', 'AUDIT_LOG'
        ),
        allowNull: false
      },
      resourceId: {
        type: DataTypes.UUID,
        allowNull: true
      },
      targetUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: TABLES.USERS,
          key: 'id'
        }
      },
      oldValues: {
        type: DataTypes.JSON,
        allowNull: true
      },
      newValues: {
        type: DataTypes.JSON,
        allowNull: true
      },
      ipAddress: {
        type: DataTypes.INET,
        allowNull: true
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'low'
      },
      complianceRelevant: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      sequelize,
      modelName: MODELS.AUDIT_LOG,
      tableName: TABLES.AUDIT_LOGS,
      timestamps: true,
      paranoid: false, // Audit logs should never be deleted
      indexes: [
        {
          fields: ['adminUserId']
        },
        {
          fields: ['action']
        },
        {
          fields: ['resource']
        },
        {
          fields: ['createdAt']
        },
        {
          fields: ['severity']
        },
        {
          fields: ['complianceRelevant']
        },
        {
          fields: ['targetUserId']
        }
      ]
    }
  );

  return AuditLog;
};
