import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITE_STATIONS_KEY = 'plugin.favoriteStationIds';

const normalizeId = (id) => (id == null ? null : String(id));

export const getFavoriteStationIds = async () => {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_STATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

export const setFavoriteStationIds = async (ids) => {
  const nextIds = Array.from(ids).map(String);
  await AsyncStorage.setItem(FAVORITE_STATIONS_KEY, JSON.stringify(nextIds));
  return new Set(nextIds);
};

export const toggleFavoriteStation = async (id) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return false;

  const ids = await getFavoriteStationIds();
  const nextValue = !ids.has(normalizedId);
  if (nextValue) {
    ids.add(normalizedId);
  } else {
    ids.delete(normalizedId);
  }
  await setFavoriteStationIds(ids);
  return nextValue;
};

export const isFavoriteStation = (ids, id) => {
  const normalizedId = normalizeId(id);
  return Boolean(normalizedId && ids?.has?.(normalizedId));
};
