const db = require('../models/index');
exports.models = db;

exports.findOne = async (tableName, params) => {
  const result = await db[tableName].findOne(params);
  return result;
};
exports.findByPk = async (tableName, params,param1) => {
  const result = await db[tableName].findByPk(params,param1);
  return result;
};
exports.bulkCreate = async (tableName, params) => {
  const result = await db[tableName].bulkCreate(params);
  return result;
};
exports.create = async (tableName, params) => {
  const result = await db[tableName].create(params);
  return result;
};
exports.findAndCountAll = async (tableName, params) => {
  const result = await db[tableName].findAndCountAll(params);
  return result;
};
exports.findAll = async (tableName, params) => {
  const result = await db[tableName].findAll(params);
  return result;
};

exports.destroy = async (tableName, params) => {
  const result = await db[tableName].destroy(params);
  return result;
};
exports.update = async (tableName, param1, param2) => {
  const result = await db[tableName].update(param1, param2);
  return result;
};
exports.bulkUpdate = async (tableName, data, options) => {
  const result = await db[tableName].bulkCreate(data, {
    updateOnDuplicate: options,
  });
  return result;
};
exports.count = async (tableName, params) => {
  const result = await db[tableName].count(params);
  return result;
};

