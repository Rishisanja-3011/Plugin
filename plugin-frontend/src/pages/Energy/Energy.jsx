import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { energyApi } from '../../api/energy';
import { adminApi } from '../../api/admin';
import { stationsApi } from '../../api/stations';
import { useAuth } from '../../context/AuthContext';
import './Energy.css';

const regionOptions = [
  ['IN-NR', 'Northern Grid'],
  ['IN-WE', 'Western Grid'],
  ['IN-SR', 'Southern Grid'],
  ['IN-ER', 'Eastern Grid'],
  ['IN-NER', 'North Eastern Grid'],
];

const localInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatTime = (value) => new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

const number = (value, digits = 0) => Number(value ?? 0).toFixed(digits);

export default function Energy({ selectedRegion, onRegionChange } = {}) {
  const { user, isCustomer, isAdmin } = useAuth();
  const [localRegion, setLocalRegion] = useState('IN-WE');
  const region = selectedRegion || localRegion;
  const setRegion = onRegionChange || setLocalRegion;
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [operator, setOperator] = useState(null);
  const [gridDashboard, setGridDashboard] = useState(null);
  const [options, setOptions] = useState(null);
  const [stations, setStations] = useState([]);
  const [customerPoints, setCustomerPoints] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionAction, setDecisionAction] = useState('');
  const [signalSaving, setSignalSaving] = useState(false);
  const [form, setForm] = useState(() => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(Date.now() + 10 * 60 * 60 * 1000);
    return {
      stationId: '', requiredEnergyKwh: '35', chargerPowerKw: '',
      stationAvailableCapacityKw: '', preference: 'BALANCED',
      earliestStartTime: localInputValue(start), latestEndTime: localInputValue(end),
    };
  });

  useEffect(() => {
    if (!isAdmin && !isCustomer) return;
    const request = isAdmin ? adminApi.getAllStations(0, 100) : stationsApi.getAll(0, 100);
    request
      .then((response) => {
        const list = response.data?.content || response.data || [];
        setStations(list);
        setSelectedStationId((currentId) => {
          const nextId = currentId || String(list[0]?.id || '');
          setForm((previous) => ({ ...previous, stationId: nextId }));
          return nextId;
        });
      })
      .catch(() => setStations([]));
  }, [isAdmin, isCustomer]);

  useEffect(() => {
    if (!isCustomer || !selectedStationId) return;
    stationsApi.getChargingPoints(selectedStationId)
      .then((response) => {
        const points = response.data?.content || response.data || [];
        const available = points.filter((point) => String(point.status).toUpperCase() === 'AVAILABLE');
        setCustomerPoints(available);
        const firstPower = Number(available[0]?.maxPowerKw || 0);
        const capacity = available.reduce((sum, point) => sum + Number(point.maxPowerKw || 0), 0);
        setForm((previous) => ({
          ...previous,
          stationId: selectedStationId,
          chargerPowerKw: firstPower ? String(firstPower) : '',
          stationAvailableCapacityKw: capacity ? String(capacity) : '',
        }));
      })
      .catch(() => {
        setCustomerPoints([]);
        setForm((previous) => ({ ...previous, chargerPowerKw: '', stationAvailableCapacityKw: '' }));
      });
  }, [isCustomer, selectedStationId]);

  useEffect(() => {
    let cancelled = false;
    const load = (showLoading = false) => {
      if (showLoading) setLoading(true);
      setError('');
      const requests = [energyApi.getCurrent(region), energyApi.getForecast(region, 24)];
      if (isAdmin) requests.push(energyApi.getOperatorDashboard(region, selectedStationId));
      if (user?.role === 'ADMIN') requests.push(energyApi.getGridDashboard(region, selectedStationId));
      Promise.allSettled(requests)
        .then(([currentResponse, forecastResponse, operatorResponse, gridResponse]) => {
          if (cancelled) return;
          setCurrent(currentResponse.value?.data ?? null);
          setForecast(forecastResponse.value?.data ?? []);
          setOperator(operatorResponse?.value?.data ?? null);
          setGridDashboard(gridResponse?.value?.data ?? null);
          if (currentResponse.status === 'rejected' || forecastResponse.status === 'rejected') {
            setError('Some energy data is unavailable. Station search and booking remain available.');
          } else if (operatorResponse?.status === 'rejected' || gridResponse?.status === 'rejected') {
            setError('The operations panel could not load. The regional energy outlook is still available.');
          }
        })
        .catch(() => !cancelled && setError('Energy outlook is temporarily unavailable. Please retry.'))
        .finally(() => !cancelled && setLoading(false));
    };
    load(true);
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') load(false);
    }, 60000);
    return () => { cancelled = true; clearInterval(refresh); };
  }, [region, isAdmin, selectedStationId, user?.role]);

  const chart = useMemo(() => forecast.slice(0, 12), [forecast]);
  const displayedOptions = useMemo(() => {
    const grouped = new Map();
    (options?.options || []).forEach((option) => {
      const key = [option.startTime, option.endTime, option.expectedPricePerKwh,
        option.expectedRenewableSharePercent, option.expectedTotalCost].join('|');
      const existing = grouped.get(key);
      if (existing) existing.strategies.push(option.scheduleType);
      else grouped.set(key, { option, strategies: [option.scheduleType] });
    });
    return [...grouped.values()];
  }, [options]);

  const optimize = async (event) => {
    event.preventDefault();
    setOptimizing(true);
    setError('');
    try {
      const response = await energyApi.getChargingOptions({
        stationId: Number(form.stationId), gridRegion: region,
        requiredEnergyKwh: Number(form.requiredEnergyKwh),
        earliestStartTime: form.earliestStartTime,
        latestEndTime: form.latestEndTime,
        chargerPowerKw: Number(form.chargerPowerKw),
        stationAvailableCapacityKw: Number(form.stationAvailableCapacityKw),
        preference: form.preference,
      });
      setOptions(response.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.message ?? 'Could not calculate charging options. Check the time window and values.');
    } finally {
      setOptimizing(false);
    }
  };

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const saveDecision = async (action) => {
    if (!selectedStationId || !operator) return;
    try {
      setDecisionSaving(true);
      setDecisionAction(action);
      setDecisionMessage('');
      await energyApi.saveOperatorDecision({
        stationId: Number(selectedStationId), gridRegion: region, action,
        recommendation: operator.recommendation,
        reason: action === 'ACCEPTED' ? 'Accepted from operator dashboard' : 'Operator review recorded',
      });
      setDecisionMessage(`Recommendation ${action.toLowerCase()} and added to the audit trail.`);
    } catch (requestError) {
      setDecisionMessage(requestError?.response?.data?.message || 'Could not save the operator decision.');
    } finally {
      setDecisionSaving(false);
      setDecisionAction('');
    }
  };

  const publishPeakSignal = async () => {
    if (!gridDashboard || !operator?.nextPeakRiskStart) return;
    const start = new Date(operator.nextPeakRiskStart);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      setSignalSaving(true);
      await energyApi.publishGridSignal({
        gridRegion: region,
        signalType: 'REDUCE_LOAD',
        requestedReductionPercent: 20,
        startsAt: localInputValue(start),
        endsAt: localInputValue(end),
        message: 'Shift flexible EV charging away from the forecast peak-risk window.',
      });
      setDecisionMessage('Demand-response signal published and added to the audit trail.');
    } catch (requestError) {
      setDecisionMessage(requestError?.response?.data?.message || 'Could not publish the grid signal.');
    } finally {
      setSignalSaving(false);
    }
  };

  return (
    <main className="energy page-wrapper">
      <section className="energy__hero">
        <div className="container energy__hero-inner">
          <div>
            <span className="energy__eyebrow">PLUGIN Renewable Optimizer</span>
            <h1>Charge when India&apos;s grid is cleaner</h1>
            <p>Compare renewable availability, grid pressure, cost and carbon before choosing your charging window.</p>
          </div>
          <label className="energy__region">Grid region
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              {regionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="container energy__content">
        {error && <div className="energy__alert" role="alert">{error}</div>}
        {loading ? <div className="energy__loading">Loading the regional energy outlook…</div> : current && (
          <>
            <div className="energy__mode-row">
              <span className="energy__mode">{current.dataMode} · {current.quality}</span>
              <span>Source: {current.source} · observed {current.sourceTimestamp ? new Date(current.sourceTimestamp).toLocaleString('en-IN') : 'timestamp unavailable'}</span>
            </div>
            {current.methodology && <p className="energy__disclaimer">{current.methodology}</p>}
            <section className="energy__metrics" aria-label="Current grid outlook">
              <article><span>Renewable share</span><strong>{number(current.renewableSharePercent)}%</strong></article>
              <article><span>Relative generation index</span><strong>{number(current.gridLoadPercent)}%</strong></article>
              <article><span>Modelled energy price · not billed tariff</span><strong>₹{number(current.electricityPricePerKwh, 2)}/kWh</strong></article>
              <article><span>Carbon intensity</span><strong>{number(current.carbonIntensityGco2PerKwh)} gCO₂/kWh</strong></article>
            </section>

            <section className="energy__panel">
              <div className="energy__section-heading"><div><span>Next 12 hours</span><h2>Renewable availability</h2></div><p>Taller bars indicate a greener charging opportunity.</p></div>
              <div className="energy__chart" aria-label="Renewable share forecast chart">
                {chart.map((point) => <div className="energy__bar-item" key={point.timestamp}>
                  <span className="energy__bar-value">{number(point.renewableSharePercent)}%</span>
                  <div className="energy__bar-track"><div className="energy__bar" style={{ height: `${point.renewableSharePercent}%` }} /></div>
                  <span>{new Date(point.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric' })}</span>
                </div>)}
              </div>
            </section>
          </>
        )}

        {isAdmin && operator && <section className="energy__panel energy__operator">
          <div className="energy__section-heading"><div><span>Operator view</span><h2>Capacity and grid guidance</h2></div>
            <label className="energy__station-select">Managed station
              <select value={selectedStationId} onChange={(event) => setSelectedStationId(event.target.value)}>
                {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
              </select>
            </label>
          </div>
          <div className="energy__operator-grid">
            <div><span>Current charging load</span><strong>{number(operator.currentChargingLoadKw, 1)} kW</strong></div>
            <div><span>Available station capacity</span><strong>{number(operator.availableCapacityKw, 1)} kW</strong></div>
                       <div><span>Total connector capacity</span><strong>{number(operator.configuredStationCapacityKw, 1)} kW</strong></div>
            <div><span>Next renewable surplus</span><strong>{formatTime(operator.nextRenewableSurplusStart)}</strong></div>
            <div><span>Peak-risk window</span><strong>{formatTime(operator.nextPeakRiskStart)}</strong></div>
            <div><span>Local solar now / forecast</span><strong>{number(operator.localSolarCurrentKw, 1)} / {number(operator.localSolarForecastKw, 1)} kW</strong></div>
            <div><span>Station battery</span><strong>{number(operator.batteryStateOfChargePercent, 0)}% of {number(operator.batteryCapacityKwh, 1)} kWh</strong></div>
            <div><span>Battery dispatch</span><strong>{operator.batteryAction?.replace(/_/g, ' ') || 'Not configured'}</strong></div>
          </div>
          {operator.batteryActionReason && <p className="energy__recommendation"><strong>{operator.stationEnergyDataMode || 'UNCLASSIFIED'}:</strong> {operator.batteryActionReason} {number(operator.batteryDispatchPowerKw, 1)} kW planned.</p>}
          {operator.activeGridSignal && <div className="energy__grid-signal" role="status">
            <strong>{operator.activeGridSignal.signalType.replace(/_/g, ' ')}</strong>
            <span>{operator.activeGridSignal.requestedReductionPercent || 0}% requested · {formatTime(operator.activeGridSignal.startsAt)}–{formatTime(operator.activeGridSignal.endsAt)}</span>
            {operator.activeGridSignal.message && <p>{operator.activeGridSignal.message}</p>}
          </div>}
          <p className="energy__recommendation">{operator.recommendation}</p>
          <div className="energy__decision-actions">
            <button type="button" className="btn btn--accent" disabled={decisionSaving} onClick={() => saveDecision('ACCEPTED')}>{decisionAction === 'ACCEPTED' ? 'Saving…' : 'Accept recommendation'}</button>
            <button type="button" className="btn btn--outline" disabled={decisionSaving} onClick={() => saveDecision('DEFERRED')}>{decisionAction === 'DEFERRED' ? 'Saving…' : 'Defer'}</button>
            <button type="button" className="btn btn--outline" disabled={decisionSaving} onClick={() => saveDecision('REJECTED')}>{decisionAction === 'REJECTED' ? 'Saving…' : 'Reject'}</button>
          </div>
          {decisionMessage && <div className="energy__notice energy__notice--inline" role="status">{decisionMessage}</div>}
        </section>}

        {user?.role === 'ADMIN' && gridDashboard && <section className="energy__panel">
          <div className="energy__section-heading"><div><span>Grid-operator persona</span><h2>Regional EV demand outlook</h2></div><p>{gridDashboard.methodology}</p></div>
          <div className="energy__operator-grid">
            <div><span>Selected station</span><strong>{stations.find((station) => String(station.id) === String(selectedStationId))?.name || 'Network station'}</strong></div>
            <div><span>Potential overload windows</span><strong>{gridDashboard.overloadWindowCount}</strong></div>
            <div><span>Forecast horizon</span><strong>24 hours</strong></div>
            <div><span>Grid data</span><strong>{gridDashboard.dataMode}</strong></div>
          </div>
          <button className="btn btn--accent energy__signal" disabled={signalSaving} onClick={publishPeakSignal}>
            {signalSaving ? 'Publishing…' : 'Publish 20% peak reduction signal'}
          </button>
        </section>}

        {decisionMessage && !operator && <div className="energy__notice" role="status">{decisionMessage}</div>}

        {isCustomer ? <section className="energy__panel">
          <div className="energy__section-heading"><div><span>Smart schedule</span><h2>Find your best charging time</h2></div><p>Your requested preference appears first.</p></div>
          <form className="energy__form" onSubmit={optimize}>
            <label>Charging station<select required value={selectedStationId} onChange={(event) => {
              setSelectedStationId(event.target.value);
              setForm((previous) => ({ ...previous, stationId: event.target.value }));
            }}>
              <option value="">Choose a station</option>
              {stations.map((station) => <option key={station.id} value={station.id}>{station.name} · {station.city}</option>)}
            </select></label>
            <label>Energy needed (kWh)<input required min="0.5" max="250" step="0.5" type="number" value={form.requiredEnergyKwh} onChange={update('requiredEnergyKwh')} /></label>
            <label>Available connector<select required value={form.chargerPowerKw} onChange={update('chargerPowerKw')}>
              <option value="">Choose a connector</option>
              {customerPoints.map((point) => <option key={point.id} value={point.maxPowerKw}>{point.identifier || point.connectorType} · {point.maxPowerKw} kW</option>)}
            </select></label>
            <label>Available station capacity<input readOnly value={form.stationAvailableCapacityKw ? `${form.stationAvailableCapacityKw} kW` : 'No available capacity'} /></label>
            <label>Earliest start<input required type="datetime-local" value={form.earliestStartTime} onChange={update('earliestStartTime')} /></label>
            <label>Finish by<input required type="datetime-local" value={form.latestEndTime} onChange={update('latestEndTime')} /></label>
            <label>Priority<select value={form.preference} onChange={update('preference')}>
              <option value="BALANCED">Balanced</option><option value="GREENEST">Greenest</option>
              <option value="CHEAPEST">Cheapest</option><option value="FASTEST">Fastest</option>
            </select></label>
            <button className="btn btn--accent energy__submit" disabled={optimizing}>{optimizing ? 'Calculating…' : 'Compare charging options'}</button>
          </form>
        </section> : !user && <section className="energy__signin"><h2>Ready for a personalized schedule?</h2><p>Sign in as a customer to compare greenest, cheapest, fastest and balanced charging options.</p><Link className="btn btn--accent" to="/login">Sign in</Link></section>}

        {options?.options?.length > 0 && <section className="energy__results">
          <div className="energy__section-heading"><div><span>Recommendation</span><h2>Your charging options</h2></div></div>
          <div className={`energy__provenance ${options.cached || options.simulated ? 'energy__provenance--warning' : ''}`}>
            <strong>{options.confidencePercent}% confidence · {options.dataMode}</strong>
            <span>{options.source} · {options.quality} · source {options.sourceTimestamp ? new Date(options.sourceTimestamp).toLocaleString('en-IN') : 'timestamp unavailable'}</span>
            {options.fallbackReason && <span>{options.fallbackReason}</span>}
          </div>
          <div className="energy__option-grid">{displayedOptions.map(({ option, strategies }, index) => <article className={`energy__option ${index === 0 ? 'energy__option--best' : ''}`} key={`${option.startTime}-${strategies.join('-')}`}>
            <div className="energy__option-title"><span>{strategies.join(' · ')}</span><strong>{option.greenScore}/100 green score</strong></div>
            {strategies.length > 1 && <p className="energy__shared-win">This window genuinely wins {strategies.length} objectives; no artificial alternative was substituted.</p>}
            <h3>{formatTime(option.startTime)} – {formatTime(option.endTime)}</h3>
            <div className="energy__option-stats"><span>{number(option.expectedRenewableSharePercent)}% renewable</span><span>₹{number(option.expectedTotalCost, 2)}</span><span>{number(option.expectedCarbonKg, 2)} kg CO₂</span></div>
            <div className="energy__option-stats"><span>{option.confidencePercent}% confidence</span><span>{Math.round(Number(option.forecastHorizonMinutes || 0) / 60)}h horizon</span><span>{option.cached ? 'Cached' : option.simulated ? 'Simulated' : 'Provider data'}</span></div>
            <div className="energy__comparison"><strong>Normal → PLUGIN</strong><span>Renewable {number(option.baselineRenewableSharePercent)}% → {number(option.expectedRenewableSharePercent)}%</span><span>Rate ₹{number(option.baselinePricePerKwh, 2)} → ₹{number(option.expectedPricePerKwh, 2)}/kWh</span><span>Save ₹{number(option.estimatedMoneySaved, 2)} · shift {number(option.renewableEnergyShiftedKwh, 2)} renewable kWh · avoid {number(option.estimatedCarbonSavedKg, 2)} kg CO₂</span></div>
            {option.gridSignalType && <div className="energy__option-signal">Grid request: {option.gridSignalType.replace(/_/g, ' ')} · {option.requestedReductionPercent || 0}%</div>}
            <p>{option.explanation}</p>
          </article>)}</div>
          <p className="energy__disclaimer">{options.disclaimer}</p>
        </section>}
      </div>
    </main>
  );
}
