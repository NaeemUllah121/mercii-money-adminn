'use strict';

const db = require('../models');
const { TABLES, MODELS, ENUMS } = require('../utils/constants');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert(TABLES.USERS, [
      {
        firstName: 'boiler',
        lastName: 'plate Admin',
        email: 'admin@gmail.com',
        password: await db[MODELS.USER].passwordHash("qwerty@1"),
        role: ENUMS.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },
  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete(TABLES.USERS, null, {});
  },
};
