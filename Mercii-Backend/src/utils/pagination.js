exports.pagination = ({ page = 1, size = 10 }) => {
  const pageNum = parseInt(page) || 1;
  const sizeNum = parseInt(size) || 10;
  const offset = (pageNum - 1) * sizeNum;
  const limit = sizeNum;
  return {
    offset,
    limit,
  };
};
