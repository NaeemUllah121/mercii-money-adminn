// Simple in-memory cache with TTL. Swap to Redis later if needed.
// Usage: getCache(key), setCache(key, value, ttlMs)

const store = new Map();

const now = () => Date.now();

function getCache(key) {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiry && item.expiry < now()) {
    store.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value, ttlMs = 120000) {
  const expiry = ttlMs ? now() + ttlMs : null;
  store.set(key, { value, expiry });
}

module.exports = { getCache, setCache };
