"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("transactions", "collection_point_id", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn("transactions", "collection_point", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("transactions", "collection_point_id");
    await queryInterface.removeColumn("transactions", "collection_point");
  },
};
