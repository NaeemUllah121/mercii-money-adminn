'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add enum values if they do not exist
    const typeName = 'enum_UserBonuses_bonusType';
    const addValueIfMissing = async (value) => {
      const sql = `DO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_type t\n    JOIN pg_enum e ON t.oid = e.enumtypid\n    WHERE t.typname = '${typeName}' AND e.enumlabel = '${value}'\n  ) THEN\n    ALTER TYPE \"${typeName}\" ADD VALUE '${value}';\n  END IF;\nEND\n$$;`;
      await queryInterface.sequelize.query(sql);
    };

    await addValueIfMissing('milestone1');
    await addValueIfMissing('milestone2');
    await addValueIfMissing('milestone3');
    await addValueIfMissing('milestone4');
  },

  down: async (queryInterface, Sequelize) => {
    // No safe down migration for removing enum values in Postgres.
  }
};
