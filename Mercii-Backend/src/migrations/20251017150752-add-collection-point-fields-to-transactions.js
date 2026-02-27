'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('transactions', 'collection_point_address', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    
    await queryInterface.addColumn('transactions', 'collection_point_city', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('transactions', 'collection_point_address');
    await queryInterface.removeColumn('transactions', 'collection_point_city');
  }
};
