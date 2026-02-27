'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addIndex('transactions', ['userId', 'createdAt'], {
      name: 'idx_user_transactions_pagination',
      type: 'BTREE'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('transactions', 'idx_user_transactions_pagination');
  }
};
