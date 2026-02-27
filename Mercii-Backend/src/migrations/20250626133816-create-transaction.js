'use strict';

const { ENUMS } = require('../utils/constants');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      benificaryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'benificaries',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      amount: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      amountInPkr: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      usiPaymentId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      sourceOfFund: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      refId: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      sendingReason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      volumePaymentId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM(ENUMS.PENDING, ENUMS.COMPLETED, ENUMS.FAILED, ENUMS.CANCLED, ENUMS.REFUNDED),
        defaultValue: ENUMS.PENDING
      },
      volumeStatus: {
        type: Sequelize.STRING,
        defaultValue: ENUMS.NOT_INITIATED
      },
      usiStatus: {
        type: Sequelize.STRING,
        defaultValue: ENUMS.NOT_INITIATED
      },
      volumeCompletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      usiCompletedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      usiResponse: {
        type: Sequelize.JSON,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('transactions', ['userId'], {
      name: 'idx_transactions_user_id'
    });

    await queryInterface.addIndex('transactions', ['benificaryId'], {
      name: 'idx_transactions_benificary_id'
    });

    await queryInterface.addIndex('transactions', ['usiPaymentId'], {
      name: 'idx_transactions_usi_payment_id'
    });

    await queryInterface.addIndex('transactions', ['volumePaymentId'], {
      name: 'idx_transactions_volume_payment_id'
    });

    await queryInterface.addIndex('transactions', ['createdAt'], {
      name: 'idx_transactions_created_at'
    });

    await queryInterface.addIndex('transactions', ['amount'], {
      name: 'idx_transactions_amount'
    });

    await queryInterface.addIndex('transactions', ['refId'], {
      name: 'idx_transactions_ref_id'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('transactions', 'idx_transactions_user_id');
    await queryInterface.removeIndex('transactions', 'idx_transactions_benificary_id');
    await queryInterface.removeIndex('transactions', 'idx_transactions_usi_payment_id');
    await queryInterface.removeIndex('transactions', 'idx_transactions_volume_payment_id');
    await queryInterface.removeIndex('transactions', 'idx_transactions_created_at');
    await queryInterface.removeIndex('transactions', 'idx_transactions_amount');
    await queryInterface.removeIndex('transactions', 'idx_transactions_ref_id');

    // Drop the table
    await queryInterface.dropTable('transactions');
  }
};