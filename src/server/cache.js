function cacheGet(key) {
  const raw = CacheService.getScriptCache().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function cachePut(key, value, ttlSeconds) {
  CacheService.getScriptCache().put(
    key,
    JSON.stringify(value),
    ttlSeconds || CACHE_TTL_SECONDS
  );
}

function cacheRemove(key) {
  CacheService.getScriptCache().remove(key);
}

function cacheRemoveMaster() {
  cacheRemove(CACHE_KEYS.MASTER_LIST);
}

function cacheRemoveSnapshot(tournamentId) {
  cacheRemove(CACHE_KEYS.SNAPSHOT(tournamentId));
}