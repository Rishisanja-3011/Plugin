const REGION_BY_STATE = {
  goa: 'IN-WE',
  gujarat: 'IN-WE',
  madhya_pradesh: 'IN-WE',
  chhattisgarh: 'IN-WE',
  dadra_and_nagar_haveli_and_daman_and_diu: 'IN-WE',
  maharashtra: 'IN-WE',
  delhi: 'IN-NR',
  chandigarh: 'IN-NR',
  haryana: 'IN-NR',
  himachal_pradesh: 'IN-NR',
  jammu_and_kashmir: 'IN-NR',
  ladakh: 'IN-NR',
  punjab: 'IN-NR',
  rajasthan: 'IN-NR',
  uttar_pradesh: 'IN-NR',
  uttarakhand: 'IN-NR',
  andhra_pradesh: 'IN-SR',
  karnataka: 'IN-SR',
  kerala: 'IN-SR',
  tamil_nadu: 'IN-SR',
  telangana: 'IN-SR',
  puducherry: 'IN-SR',
  bihar: 'IN-ER',
  jharkhand: 'IN-ER',
  odisha: 'IN-ER',
  sikkim: 'IN-ER',
  west_bengal: 'IN-ER',
  arunachal_pradesh: 'IN-NER',
  assam: 'IN-NER',
  manipur: 'IN-NER',
  meghalaya: 'IN-NER',
  mizoram: 'IN-NER',
  nagaland: 'IN-NER',
  tripura: 'IN-NER',
};

const normalizeState = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z]+/g, '_')
  .replace(/^_|_$/g, '');

export const gridRegionForStation = (station) => REGION_BY_STATE[normalizeState(station?.state)] || 'IN-WE';

export const energyModeLabel = (mode) => {
  const normalized = String(mode || '').toUpperCase();
  if (normalized === 'LIVE') return 'LIVE';
  if (normalized === 'STALE') return 'STALE';
  if (normalized === 'FORECAST') return 'FORECAST';
  return normalized || 'UNAVAILABLE';
};

export const renewableTone = (share) => {
  const value = Number(share);
  if (!Number.isFinite(value)) return 'Grid signal unavailable';
  if (value >= 60) return 'Excellent time to charge';
  if (value >= 40) return 'Good renewable availability';
  if (value >= 20) return 'Moderate renewable availability';
  return 'Cleaner window may be available later';
};
