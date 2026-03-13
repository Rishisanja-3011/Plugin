import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { stationsApi } from '../../api/stations';
import { SkeletonCard } from '../../components/SkeletonLoader/SkeletonLoader';
import IconGlyph from '../../components/IconGlyph/IconGlyph';
import './Search.css';

const CHARGER_FILTERS = ['All', 'Fast', 'Slow'];
const PAGE_SIZE = 12;

export default function Search() {
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [chargerFilter, setChargerFilter] = useState('All');
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const fetchStations = async (pageNum = 0, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const trimmedQuery = query.trim();
      const isNumeric = /^\d+$/.test(trimmedQuery);
      if (isNumeric && trimmedQuery.length !== 6) {
        setStations([]);
        setTotalPages(0);
        setTotalElements(0);
        return;
      }

      const res = trimmedQuery
        ? await stationsApi.search(trimmedQuery, pageNum, PAGE_SIZE)
        : await stationsApi.getAll(pageNum, PAGE_SIZE);
      const data = res.data;
      const content = data.content ?? data.stations ?? data ?? [];
      const total = data.totalElements ?? data.total ?? content.length;
      const pages = data.totalPages ?? (Math.ceil(total / PAGE_SIZE) || 1);

      const stationList = Array.isArray(content) ? content : [];

      const withPoints = await Promise.all(
        stationList.map(async (s) => {
          try {
            const cpRes = await stationsApi.getChargingPoints(s.id);
            const pts = Array.isArray(cpRes.data) ? cpRes.data : cpRes.data?.content ?? [];
            return { ...s, chargingPoints: pts };
          } catch {
            return { ...s, chargingPoints: [] };
          }
        })
      );

      setStations(withPoints);
      setTotalPages(pages);
      setTotalElements(total);
    } catch (err) {
      if (showLoading) {
        setStations([]);
        setTotalPages(0);
        setTotalElements(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations(page, true);
  }, [query, page]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchStations(page, false);
    }, 500);
    return () => clearInterval(pollInterval);
  }, [query, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput);
    setPage(0);
  };

  const filterStations = (list) => {
    if (chargerFilter === 'All') return list;
    const type = chargerFilter.toUpperCase();
    return list.filter((s) => {
      const points = s.chargingPoints ?? [];
      if (points.length) {
        return points.some((p) => (p.pointType ?? '').toUpperCase() === type);
      }
      return false;
    });
  };

  const filteredStations = filterStations(stations);
  const trimmedQuery = query.trim();
  const isNumericQuery = /^\d+$/.test(trimmedQuery);
  const isIncompletePincode = isNumericQuery && trimmedQuery.length !== 6;

  const getAvailableCount = (station) => {
    return station.availablePoints ?? station.available_points ?? station.chargingPoints?.filter((p) => p.status === 'AVAILABLE').length ?? 0;
  };

  const getTotalCount = (station) => {
    const points = station.chargingPoints ?? station.charging_points ?? [];
    return points.length || (station.totalPoints ?? station.total_points ?? 0);
  };

  const isStationActive = (station) => {
    if (typeof station.active === 'boolean') return station.active;
    if (typeof station.isActive === 'boolean') return station.isActive;
    return true;
  };

  const formatAvailability = (station) => {
    if (!isStationActive(station)) {
      return 'Station Closed';
    }
    const available = getAvailableCount(station);
    const total = getTotalCount(station);
    return total > 0 ? `${available} / ${total} available` : `${available} available`;
  };

  return (
    <motion.main
      className="search page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <div className="page-header">
          <h1 className="page-header__title">Find Charging Stations</h1>
          <p className="page-header__subtitle">
            Search by city, area, or pincode
          </p>
        </div>

        <form className="search__form" onSubmit={handleSearch}>
          <div className="search__bar">
            <span className="search__icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              className="search__input"
              placeholder="City, area, or pincode..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="search__btn">
              Search
            </button>
          </div>
        </form>

        <div className="search__filters">
          {CHARGER_FILTERS.map((filter) => (
            <motion.button
              key={filter}
              type="button"
              className={`search__chip ${chargerFilter === filter ? 'search__chip--active' : ''}`}
              onClick={() => setChargerFilter(filter)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              {filter}
            </motion.button>
          ))}
        </div>

        {loading ? (
          <div className="search__grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              {filteredStations.length === 0 ? (
                <motion.div
                  className="empty-state"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="empty-state__icon"><IconGlyph glyph={'\u{1F50C}'} className="mono-icon mono-icon--lg" /></div>
                  <h2 className="empty-state__title">
                    {isIncompletePincode ? 'Enter full pincode' : 'No stations found'}
                  </h2>
                  <p className="empty-state__text">
                    {isIncompletePincode
                      ? 'Please enter a 6-digit pincode to see stations in that area.'
                      : 'Try a different search or filter to find charging stations near you.'}
                  </p>
                </motion.div>
              ) : (
                <div className="search__grid">
                  <AnimatePresence mode="popLayout">
                    {filteredStations.map((station, i) => (
                      <motion.div
                        key={station.id ?? i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        layout
                      >
                        <Link
                          to={`/stations/${station.id}`}
                          className={`search__card card ${!isStationActive(station) ? 'search__card--closed' : ''}`}
                        >
                          <div className="search__card-top" />
                          <div className="search__card-body">
                            <div className="search__card-header">
                              <h3 className="search__card-title">
                                {station.name ?? station.stationName ?? 'Unnamed Station'}
                              </h3>
                              <span
                                className={`search__card-badge ${!isStationActive(station) ? 'search__card-badge--closed' : ''}`}
                              >
                                {formatAvailability(station)}
                              </span>
                            </div>
                            <p className="search__card-address">
                              {station.address ?? station.stationAddress ?? '-'}
                            </p>
                            <p className="search__card-city">
                              {station.city ?? station.area ?? '-'}
                            </p>
                            {station.pricing && (
                              <p className="search__card-pricing">
                                {typeof station.pricing === 'object'
                                  ? `₹${station.pricing.ratePerUnit ?? station.pricing.rate_per_unit ?? '-'}/kWh`
                                  : String(station.pricing)}
                              </p>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>

            {totalPages > 1 && chargerFilter === 'All' && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination__btn"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span className="pagination__info">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination__btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.main>
  );
}

