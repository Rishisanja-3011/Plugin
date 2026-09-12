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
  const [form, setForm] = useState({ signalType: 'REDUCE_LOAD', requestedReductionPercent: 20,
    startsAt: localTime(new Date()), endsAt: localTime(new Date(Date.now() + 3600000)), message: '' });
  const load = async () => {
    try { setSignals((await api.get('/grid/signals', { params: { region } })).data); }
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
  return <>
    <Energy selectedRegion={region} onRegionChange={setRegion} />
    <section className="container energy__panel" style={{ marginBottom: 40 }}>
      <h2>Grid operations · {region}</h2>
      <label>Station demand forecast <select value={stationId} onChange={e => setStationId(e.target.value)}>
        {stations.map(station => <option key={station.id} value={station.id}>{station.name} · {station.state}</option>)}
      </select></label>
      {demand && <section className="energy__panel">
        <h3>Station capacity and risk</h3>
        <p>Station grid region: {demand.gridRegion}. The signal composer below applies to {region}.</p>
        <p>{demand.stationCapacityKw} kW total connector rating · {demand.overloadWindowCount} forecast risk windows</p>
        <p>{demand.methodology}. Connector ratings are not a verified utility feeder limit.</p>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
          <thead><tr><th>Time</th><th>Expected demand (kW)</th><th>Risk</th></tr></thead>
          <tbody>{demand.evDemandForecast?.slice(0, 12).map(point => <tr key={point.timestamp}><td>{new Date(point.timestamp).toLocaleTimeString('en-IN')}</td><td>{point.expectedChargingDemandKw}</td><td>{point.overloadRisk ? 'Above capacity' : 'Within capacity'}</td></tr>)}</tbody>
        </table></div>
      </section>}
      <p>Coordinate flexible charging through scheduled demand-response signals. These requests affect PLUGIN planning; physical charger dispatch requires an operator integration.</p>
      <form className="energy__form" onSubmit={submit}>
        <label>Signal<select value={form.signalType} onChange={e => setForm({ ...form, signalType: e.target.value })}>
          <option value="REDUCE_LOAD">Reduce charging load</option><option value="SHIFT_TO_RENEWABLE">Prefer renewable windows</option><option value="NORMAL_OPERATION">Normal operation advisory</option>
        </select></label>
        <label>Reduction (%)<input type="number" min="0" max="100" required value={form.requestedReductionPercent} onChange={e => setForm({ ...form, requestedReductionPercent: e.target.value })} /></label>
        <label>Start (local time)<input type="datetime-local" required value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label>
        <label>End (local time)<input type="datetime-local" required value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label>
        <label>Operator guidance<input maxLength="1000" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label>
        <button className="btn btn--accent" disabled={busy}>Publish signal</button>
      </form>
      {message && <p role="status">{message}</p>}
      <h3>Recent signals</h3>
      {!signals.length && <p>No published signals for this region.</p>}
      {signals.map(signal => <article className="energy__panel" key={signal.id}>
        <strong>{signal.signalType.replaceAll('_', ' ')} · {signal.requestedReductionPercent}%</strong>
        <p>{new Date(signal.startsAt).toLocaleString('en-IN')} – {new Date(signal.endsAt).toLocaleString('en-IN')}</p>
        <p>{signal.message}</p>
        {signal.cancelled ? <span>Cancelled</span> : new Date(signal.endsAt) < new Date() ? <span>Expired</span> : <button className="btn btn--outline" disabled={busy} onClick={() => cancel(signal.id)}>Cancel signal</button>}
      </article>)}
    </section>
  </>;
}
