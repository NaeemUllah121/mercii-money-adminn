exports.uploadFile = async (file, path, filename) => {
  await file.mv(path + filename);
};
