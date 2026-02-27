'use strict';

const { TABLES, ENUMS } = require('../utils/constants');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLES.BENIFICARIES, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: TABLES.USERS,
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      type: {
        type: Sequelize.ENUM(ENUMS.MYSELF, ENUMS.BUSINESS, ENUMS.SOMEONE_ELSE),
        allowNull: true,
        defaultValue: ENUMS.MYSELF
      },
      fName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      iban: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      bankName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(255),
        defaultValue: 'Pakistan'
      },
      address1: {
        type: Sequelize.STRING(255)
      },
      city: {
        type: Sequelize.STRING(255)
      },
      deliveryMethod: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      contactNo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      pickupLocation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      USIbeneficiaryId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable(TABLES.BENIFICARIES);
  }
};