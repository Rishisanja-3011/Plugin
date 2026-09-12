import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Energy from './Energy';

const localTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function GridWorkspace() {
  const [region, setRegion] = useState('IN-WE');
  const [signals, setSignals] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState('');
  const [demand, setDemand] = useState(null);
  const [impact, setImpact] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [form, setForm] = useState({ signalType: 'REDUCE_LOAD', requestedReductionPercent: 20,
    startsAt: localTime(new Date()), endsAt: localTime(new Date(Date.now() + 3600000)), message: '' });
  const load = async () => {
    try {
      const [signalResponse, impactResponse, accuracyResponse] = await Promise.all([
        api.get('/grid/signals', { params: { region } }), api.get('/grid/impact'),
        api.get('/grid/forecast-accuracy', { params: { region } }),
      ]);
      setSignals(signalResponse.data); setImpact(impactResponse.data); setAccuracy(accuracyResponse.data);
    }
    catch (error) { setMessage(error.response?.data?.message || 'Could not load grid signals.'); }
  };
  useEffect(() => { load(); }, [region]);
  useEffect(() => {
    api.get('/stations', { params: { page: 0, size: 100 } }).then(response => {
      const list = response.data.content || [];
      setStations(list); setStationId(String(list[0]?.id || ''));
    }).catch(() => setMessage('Station catalogue unavailable.'));
  }, []);
  useEffect(() => {
    if (!stationId) return;
    let active = true;
    setDemand(null);
    api.get('/grid/dashboard', { params: { region, stationId } }).then(response => {
      if (active) setDemand(response.data);
    }).catch(() => { if (active) setMessage('Station demand forecast unavailable.'); });
    return () => { active = false; };
  }, [region, stationId]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api.post('/grid/signals', { ...form, gridRegion: region, requestedReductionPercent: Number(form.requestedReductionPercent) });
      await load(); setMessage('Grid signal published. Charging recommendations use it during its effective window.');
    } catch (error) { setMessage(error.response?.data?.message || 'Could not publish signal.'); }
    finally { setBusy(false); }
  };
  const cancel = async (id) => {
    setBusy(true);
    try { await api.delete(`/grid/signals/${id}`); await load(); setMessage('Signal cancelled.'); }
    catch (error) { setMessage(error.response?.data?.message || 'Could not cancel signal.'); }
    finally { setBusy(false); }
  };
  const close = async (signal) => {
    const expected = Number(signal.expectedReductionKw || 0);
    setBusy(true);
    try { await api.post(`/grid/signals/${signal.id}/close`, { achievedReductionKw: expected }); await load(); setMessage('Signal closed and achieved reduction recorded.'); }
    catch (error) { setMessage(error.response?.data?.message || 'Could not close signal.'); }
    finally { setBusy(false); }
  };
  return <>
    <Energy selectedRegion={region} onRegionChange={setRegion} />
    <section className="container energy__panel grid-ops">
      <div className="energy__section-heading grid-ops__heading">
        <div><span>Control room</span><h2>Grid operations · {region}</h2></div>
        <p>Publish traceable demand-response guidance for connected charging stations.</p>
      </div>
      <label className="grid-ops__station">Station demand forecast <select value={stationId} onChange={e => setStationId(e.target.value)}>
        {stations.map(station => <option key={station.id} value={station.id}>{station.name} · {station.state}</option>)}
      </select></label>
      {demand && <section className="grid-ops__forecast">
        <h3>Station capacity and risk</h3>
        <p>Station grid region: {demand.gridRegion}. The signal composer below applies to {region}.</p>
        <div className="grid-ops__summary"><strong>{demand.stationCapacityKw} kW</strong><span>Total connector rating</span><strong>{demand.overloadWindowCount}</strong><span>Forecast risk windows</span></div>
        <p className="grid-ops__method">{demand.methodology}. Connector ratings are not a verified utility feeder limit.</p>
        <div className="grid-ops__table-wrap"><table className="grid-ops__table">
          <thead><tr><th>Time</th><th>Expected demand (kW)</th><th>Risk</th></tr></thead>
          <tbody>{demand.evDemandForecast?.slice(0, 12).map(point => <tr key={point.timestamp}><td>{new Date(point.timestamp).toLocaleTimeString('en-IN')}</td><td>{point.expectedChargingDemandKw}</td><td><span className={`grid-ops__risk ${point.overloadRisk ? 'grid-ops__risk--high' : ''}`}>{point.overloadRisk ? 'Above capacity' : 'Within capacity'}</span></td></tr>)}</tbody>
        </table></div>
      </section>}
      <p>Coordinate flexible charging through scheduled demand-response signals. These requests affect PLUGIN planning; physical charger dispatch requires an operator integration.</p>
      {impact && <section className="grid-ops__impact">
        <h3>Renewable impact from locked bookings</h3>
        <div className="energy__metrics">
          <article><span>Renewable utilized</span><strong>{impact.renewableEnergyUtilizedKwh} kWh</strong></article>
          <article><span>Demand shifted</span><strong>{impact.demandShiftedKwh} kWh</strong></article>
          <article><span>CO₂ avoided</span><strong>{impact.estimatedCarbonAvoidedKg} kg</strong></article>
          <article><span>Green acceptance</span><strong>{impact.acceptanceRatePercent}%</strong></article>
        </div><p className="grid-ops__method">{impact.methodology}</p>
      </section>}
      {accuracy && <section className="grid-ops__forecast">
        <h3>Forecast accuracy history</h3>
        <div className="grid-ops__summary"><strong>{accuracy.accuracyPercent}%</strong><span>Accuracy</span><strong>{accuracy.reconciledRecords}</strong><span>Verified forecast points</span></div>
        <p className="grid-ops__method">Mean absolute error: {accuracy.meanAbsoluteErrorPercent} percentage points. {accuracy.methodology}</p>
        {!!accuracy.records?.length && <div className="grid-ops__table-wrap"><table className="grid-ops__table"><thead><tr><th>Target</th><th>Forecast</th><th>Observed</th><th>Error</th><th>Mode</th></tr></thead>
          <tbody>{accuracy.records.slice(0, 12).map(record => <tr key={record.id}><td>{new Date(record.targetTime).toLocaleString('en-IN')}</td><td>{record.predictedRenewableSharePercent}%</td><td>{record.actualRenewableSharePercent ?? 'Pending'}</td><td>{record.absoluteErrorPercent ?? '—'}</td><td>{record.dataMode}</td></tr>)}</tbody></table></div>}
      </section>}
      <form className="energy__form" onSubmit={submit}>
        <label>Signal<select value={form.signalType} onChange={e => setForm({ ...form, signalType: e.target.value })}>
          <option value="REDUCE_LOAD">Reduce charging load</option><option value="SHIFT_TO_RENEWABLE">Prefer renewable windows</option><option value="NORMAL_OPERATION">Normal operation advisory</option>
        </select></label>
        <label>{form.signalType === 'SHIFT_TO_RENEWABLE' ? 'Renewable price discount (%)' : 'Load reduction (%)'}<input type="number" min="0" max="100" required value={form.requestedReductionPercent} onChange={e => setForm({ ...form, requestedReductionPercent: e.target.value })} /></label>
        <label>Start (local time)<input type="datetime-local" required value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label>
        <label>End (local time)<input type="datetime-local" required value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label>
        <label>Operator guidance<input maxLength="1000" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label>
        <button className="btn btn--accent" disabled={busy}>Publish signal</button>
      </form>
      {message && <p className="energy__notice" role="status">{message}</p>}
      <h3>Recent signals</h3>
      {!signals.length && <p>No published signals for this region.</p>}
      <div className="grid-ops__signals">{signals.map(signal => <article className="grid-ops__signal" key={signal.id}>
        <div><strong>{signal.signalType.replaceAll('_', ' ')} · {signal.requestedReductionPercent}%</strong>
        <p>{new Date(signal.startsAt).toLocaleString('en-IN')} – {new Date(signal.endsAt).toLocaleString('en-IN')}</p>
        <p>{signal.message}</p></div>
        <div className="grid-ops__signal-actions"><span>{signal.status || (signal.cancelled ? 'CANCELLED' : 'ACTIVE')}</span>
        {signal.expectedReductionKw != null && <small>{signal.achievedReductionKw ?? 0}/{signal.expectedReductionKw} kW achieved</small>}
        {!signal.cancelled && signal.status !== 'CLOSED' && <><button className="btn btn--accent" disabled={busy} onClick={() => close(signal)}>Close event</button><button className="btn btn--outline" disabled={busy} onClick={() => cancel(signal.id)}>Cancel signal</button></>}</div>
      </article>)}</div>
    </section>
  </>;
}
