'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ScreeningResults', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        // No DB default to avoid requiring uuid-ossp; Sequelize model will generate UUIDv4
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      isRemmiter: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      names: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      dob: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      gender: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      fuzzy_search: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      totalHits: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      message: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      matched: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      matchedRecord: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      rawResponse: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('ScreeningResults', ['userId']);
    await queryInterface.addIndex('ScreeningResults', ['isRemmiter']);
    await queryInterface.addIndex('ScreeningResults', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ScreeningResults');
  }
};
