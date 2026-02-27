'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { MODELS, TABLES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) => {
  class AdminUser extends Model {
    static associate(models) {
      this.hasMany(models[MODELS.AUDIT_LOG], {
        as: 'auditLogs',
        foreignKey: 'adminUserId',
        onDelete: 'cascade',
        onUpdate: 'cascade',
      });
      this.hasMany(models[MODELS.ADMIN_SESSION], {
        as: 'sessions',
        foreignKey: 'adminUserId',
        onDelete: 'cascade',
        onUpdate: 'cascade',
      });
    }

    async validatePassword(password) {
      return await bcrypt.compare(password, this.password);
    }

    async updatePassword(newPassword) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(newPassword, saltRounds);
      await this.save();
    }

    hasPermission(permission) {
      const rolePermissions = {
        admin: ['read', 'write', 'delete', 'manage_users', 'manage_system', 'approve_mlro', 'view_pii'],
        mlro: ['read', 'write', 'approve_mlro', 'view_pii'],
        support: ['read', 'write', 'suspend_customers', 'resend_kyc'],
        viewer: ['read']
      };
      
      return rolePermissions[this.role]?.includes(permission) || false;
    }

    get maskedEmail() {
      if (!this.email) return null;
      const [username, domain] = this.email.split('@');
      const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
      return `${maskedUsername}@${domain}`;
    }
  }

  AdminUser.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          isAlphanumeric: true
        }
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          len: [8, 255]
        }
      },
      role: {
        type: DataTypes.ENUM('admin', 'mlro', 'support', 'viewer'),
        allowNull: false,
        defaultValue: 'viewer'
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          len: [1, 100]
        }
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          len: [1, 100]
        }
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      mfaSecret: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      mfaEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      failedLoginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      lockedUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      passwordChangedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      allowedIPs: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null
      },
      ssoProvider: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      ssoId: {
        type: DataTypes.STRING(150),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: MODELS.ADMIN_USER,
      tableName: TABLES.ADMIN_USERS,
      timestamps: true,
      hooks: {
        beforeCreate: async (admin) => {
          if (admin.password) {
            const saltRounds = 12;
            admin.password = await bcrypt.hash(admin.password, saltRounds);
          }
        },
        beforeUpdate: async (admin) => {
          if (admin.changed('password')) {
            const saltRounds = 12;
            admin.password = await bcrypt.hash(admin.password, saltRounds);
            admin.passwordChangedAt = new Date();
          }
        }
      },
      indexes: [
        {
          unique: true,
          fields: ['username']
        },
        {
          unique: true,
          fields: ['email']
        },
        {
          fields: ['role']
        },
        {
          fields: ['isActive']
        },
        {
          fields: ['ssoProvider', 'ssoId']
        }
      ]
    }
  );

  return AdminUser;
};
