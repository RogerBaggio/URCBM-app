function cacheGet_(key) {
  const raw = CacheService.getScriptCache().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function cachePut_(key, value, ttlSeconds) {
  CacheService.getScriptCache().put(
    key,
    JSON.stringify(value),
    ttlSeconds || CACHE_TTL_SECONDS
  );
}

function cacheRemove_(key) {
  CacheService.getScriptCache().remove(key);
}

function cacheRemoveMaster_() {
  cacheRemove_(CACHE_KEYS.MASTER_LIST);
}

function cacheRemoveSnapshot_(tournamentId) {
  cacheRemove_(CACHE_KEYS.SNAPSHOT(tournamentId));
}