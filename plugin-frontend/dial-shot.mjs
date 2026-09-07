/**
 * Local-only visual check for the landing page problem dial.
 * Temporary tooling: drives headless Chrome over CDP, scrolls the pinned
 * problem section to each step, and writes PNGs plus geometry measurements.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const outDir = process.argv[3] ?? './dial-shots';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const profile = join(tmpdir(), `dial-shot-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findPageTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('no page target');
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let next = 1;
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = (next += 1);
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => socket.close() };
}

const child = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1600,1000',
  url,
], { stdio: 'ignore' });

try {
  const target = await findPageTarget();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Page.navigate', { url });
  await sleep(3500);
  /* headless reports reduced motion by default, which swaps in the list */
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await sleep(1500);

  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  const metrics = await evaluate(`(() => {
    const track = document.querySelector('.lp-dial-track');
    if (!track) return null;
    return {
      top: track.getBoundingClientRect().top + window.scrollY,
      height: track.offsetHeight,
      view: window.innerHeight,
      nodes: document.querySelectorAll('.lp-dial__node').length,
      ticks: document.querySelectorAll('.lp-dial-grad__tick').length,
    };
  })()`);
  if (!metrics) throw new Error('dial not rendered');
  console.log('metrics', metrics);

  await mkdir(outDir, { recursive: true });

  for (const step of [0, 1, 2]) {
    const progress = 0.04 + (step / 2) * (0.9 - 0.04);
    const y = Math.round(metrics.top + progress * (metrics.height - metrics.view));
    await evaluate(`window.scrollTo(0, ${y}); true`);
    await sleep(1800);

    const state = await evaluate(`(() => {
      const box = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const dot = box('.lp-dial__node.is-on .lp-dial__node-dot');
      const gate = box('.lp-dial-gate__ring');
      const info = box('.lp-dial-info');
      const desc = box('.lp-dial-desc');
      const beam = box('.lp-dial-gate__beam');
      const face = box('.lp-dial-face');
      const hub = box('.lp-dial-hub');
      const nodes = [...document.querySelectorAll('.lp-dial__node-dot')].map((n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
      return {
        active: document.querySelector('.lp-dial-hub__n').textContent,
        signal: document.querySelector('.lp-dial-hub__sig').textContent,
        seatOffset: dot && gate ? { x: Math.round((dot.x + dot.w / 2) - (gate.x + gate.w / 2)), y: Math.round((dot.y + dot.h / 2) - (gate.y + gate.h / 2)) } : null,
        gapTextToBeam: desc && beam ? Math.round(beam.x - (desc.x + desc.w)) : null,
        infoRight: info ? info.x + info.w : null,
        face, hub, gate, beam, nodes,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    console.log(`step ${step}`, JSON.stringify(state));

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(outDir, `dial-${step}.png`), Buffer.from(shot.data, 'base64'));
  }

  cdp.close();
} finally {
  child.kill();
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
