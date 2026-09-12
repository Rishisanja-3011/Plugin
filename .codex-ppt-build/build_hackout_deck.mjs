import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = 'E:/study/projects/EV Charging Network Renewable-Optimization Platform';
const buildDir = path.join(workspaceDir, '.codex-ppt-build');
const outDir = path.join(workspaceDir, 'output/presentations');
const skillDir = 'C:/Users/PRIT/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const finalPath = path.join(outDir, 'PLUGIN_HackOut26_Renewable_EV_Charging_Pitch_Final.pptx');
const pythonExecutable = 'C:/Users/PRIT/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const FONT = 'Arial';
const C = {
  black: '#070908',
  panel: '#111612',
  panel2: '#182019',
  green: '#42E675',
  lime: '#B8FF4D',
  white: '#F6F8F6',
  gray: '#A8B0AA',
  dim: '#677069',
  rule: '#29312B',
  red: '#FF7B6B',
  amber: '#FFD166',
};

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outDir, { recursive: true });

const pres = Presentation.create({ slideSize: { width: 1280, height: 720 } });

function box(slide, x, y, w, h, fill = C.panel, radius = 18, line = C.rule) {
  return slide.shapes.add({
    geometry: 'roundRect',
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: line, width: 1 },
    borderRadius: radius,
  });
}

function txt(slide, text, x, y, w, h, size = 24, color = C.white, bold = false, align = 'left') {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { fill: 'none', width: 0 },
  });
  shape.text = text;
  shape.text.style = { typeface: FONT, fontSize: size, color, bold, autoFit: 'shrinkText', alignment: align };
  return shape;
}

function line(slide, x, y, w, h, color = C.rule, width = 2) {
  return slide.shapes.add({
    geometry: 'line',
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { fill: color, width },
  });
}

function dot(slide, x, y, d = 12, color = C.green) {
  return slide.shapes.add({
    geometry: 'ellipse',
    position: { left: x, top: y, width: d, height: d },
    fill: color,
    line: { fill: color, width: 0 },
  });
}

function title(slide, heading, page, subtitle = '') {
  txt(slide, 'PLUGIN', 62, 32, 130, 28, 16, C.green, true);
  txt(slide, heading, 62, 78, 1050, 58, 34, C.white, true);
  if (subtitle) txt(slide, subtitle, 64, 138, 1020, 34, 17, C.gray, false);
  txt(slide, String(page).padStart(2, '0'), 1172, 37, 44, 24, 14, C.dim, true, 'right');
}

function addNote(slide, note) {
  slide.speakerNotes.textFrame.setText(note);
}

async function addImage(slide, file, x, y, w, h, fit = 'contain', alt = 'Product screenshot') {
  const blob = await fs.readFile(file);
  return slide.images.add({ blob, contentType: 'image/png', alt, fit, position: { left: x, top: y, width: w, height: h }, geometry: 'roundRect', borderRadius: 16 });
}

function stat(slide, value, label, x, y, w, accent = C.green) {
  txt(slide, value, x, y, w, 54, 38, accent, true);
  txt(slide, label, x, y + 56, w, 44, 16, C.gray, false);
}

// 1. Cover
{
  const s = pres.slides.add();
  s.background.fill = C.black;
  for (let i = 0; i < 7; i++) {
    line(s, 740 + i * 55, 90 + i * 44, 370 - i * 34, 250 - i * 24, i % 2 ? C.rule : '#1B4A2A', 2);
    dot(s, 750 + i * 64, 108 + i * 48, 10 + (i % 3) * 3, i % 2 ? C.lime : C.green);
  }
  txt(s, 'PLUGIN', 72, 58, 190, 42, 22, C.green, true);
  txt(s, 'Renewable-aware\nEV charging', 72, 166, 680, 164, 56, C.white, true);
  txt(s, 'Shift charging demand into cleaner hours, reward flexibility, and help operators use more renewable energy.', 76, 356, 620, 92, 23, C.gray, false);
  box(s, 76, 520, 424, 52, '#0D2415', 26, '#245B34');
  txt(s, "HackOut'26 Phase 1 Ideation", 100, 530, 375, 28, 17, C.green, true);
  txt(s, 'Mobile driver app + station operations + grid intelligence', 76, 600, 610, 30, 15, C.dim, false);
  addNote(s, 'Opening: EV charging becomes more valuable to the grid when the platform can move flexible demand into renewable-rich windows. PLUGIN adds that intelligence to a working EV charging platform.');
}

// 2. Problem
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'The renewable utilization gap', 2, 'Renewable supply and EV charging demand often peak at different times');
  txt(s, 'Renewable supply', 86, 206, 250, 30, 17, C.green, true);
  txt(s, 'EV charging demand', 86, 392, 250, 30, 17, C.white, true);
  line(s, 345, 222, 735, 0, C.rule, 2);
  line(s, 345, 408, 735, 0, C.rule, 2);
  const renew = [18, 30, 56, 104, 150, 126, 78, 34];
  const demand = [32, 40, 44, 54, 68, 104, 144, 116];
  for (let i = 0; i < renew.length; i++) {
    const x = 365 + i * 88;
    s.shapes.add({ geometry: 'rect', position: { left: x, top: 330 - renew[i], width: 52, height: renew[i] }, fill: C.green, line: { fill: C.green, width: 0 }, borderRadius: 8 });
    s.shapes.add({ geometry: 'rect', position: { left: x, top: 550 - demand[i], width: 52, height: demand[i] }, fill: '#E8EEE9', line: { fill: '#E8EEE9', width: 0 }, borderRadius: 8 });
    txt(s, `${6 + i * 2}:00`, x - 8, 570, 70, 24, 12, C.dim, false, 'center');
  }
  box(s, 78, 622, 1120, 48, '#19130B', 14, '#4D3A18');
  txt(s, 'Result: clean energy can be curtailed earlier while unmanaged charging adds pressure later.', 104, 632, 1070, 28, 18, C.amber, true);
  addNote(s, 'This is a conceptual profile, not measured system data. The design problem is temporal mismatch: flexible charging can absorb more renewable supply when users receive a practical incentive and a feasible alternative.');
}

// 3. Solution loop
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'The PLUGIN control loop', 3, 'Forecast, optimize, incentivize, book, and measure');
  const items = [
    ['01', 'Sense', 'Regional renewable share, grid load, carbon and station capacity'],
    ['02', 'Optimize', 'Evaluate feasible stations and 30-minute charging windows'],
    ['03', 'Incentivize', 'Lower the rate when renewable availability improves'],
    ['04', 'Commit', 'Driver selects a recommendation and locks the quoted price'],
    ['05', 'Measure', 'Track renewable kWh, savings and peak demand avoided'],
  ];
  items.forEach((it, i) => {
    const x = 66 + i * 238;
    if (i < items.length - 1) line(s, x + 182, 330, 56, 0, '#326641', 3);
    box(s, x, 204, 205, 294, i === 2 ? '#102619' : C.panel, 22, i === 2 ? '#2A7440' : C.rule);
    txt(s, it[0], x + 22, 224, 70, 42, 24, C.green, true);
    txt(s, it[1], x + 22, 286, 160, 42, 25, C.white, true);
    txt(s, it[2], x + 22, 350, 160, 108, 16, C.gray, false);
  });
  txt(s, 'The same loop coordinates the driver, station operator, and grid operator.', 192, 570, 900, 42, 24, C.white, true, 'center');
  addNote(s, 'The project extends the existing booking platform rather than replacing it. The renewable layer changes which station and time the system recommends, how the price responds, and what impact the platform records.');
}

// 4. Product proof
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Working mobile experience', 4, 'The customer compares feasible charging choices before booking');
  const shots = [
    'C:/Users/PRIT/AppData/Local/Temp/codex-clipboard-2d6487b4-0c5f-4c36-b323-50f156b8a0b7.png',
    'C:/Users/PRIT/AppData/Local/Temp/codex-clipboard-ce69af08-fc75-4da0-9768-8bdacfdba0bd.png',
    'C:/Users/PRIT/AppData/Local/Temp/codex-clipboard-b145fec6-cf85-46f5-a69a-c85662b24fd4.png',
  ];
  const labels = ['Set energy and preference', 'Compare dynamic outcomes', 'Choose a greener time'];
  for (let i = 0; i < 3; i++) {
    box(s, 80 + i * 400, 186, 332, 438, '#EDEFEA', 26, '#353B36');
    await addImage(s, shots[i], 92 + i * 400, 198, 308, 372, 'contain', labels[i]);
    txt(s, labels[i], 98 + i * 400, 582, 296, 30, 15, C.black, true, 'center');
  }
  addNote(s, 'Screenshots supplied from the current mobile build. The backend now returns separate Balanced, Greenest, Cheapest and Fastest windows using a 24-hour search horizon and renewable-adjusted prices.');
}

// 5. Optimizer
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'How the optimizer decides', 5, 'Every recommendation must pass operational constraints before ranking');
  const constraints = ['Connector available', 'Station open', 'No booking overlap', 'Energy deliverable', 'Capacity within limit'];
  constraints.forEach((v, i) => {
    const y = 202 + i * 78;
    dot(s, 92, y + 11, 12, C.green);
    txt(s, v, 122, y, 270, 36, 19, C.white, true);
    line(s, 410, y + 18, 94, 0, C.rule, 2);
  });
  box(s, 510, 214, 250, 332, '#102619', 28, '#2A7440');
  txt(s, 'Feasible\n30-minute\nwindows', 548, 286, 174, 150, 31, C.green, true, 'center');
  const goals = [
    ['GREENEST', 'Highest renewable share'],
    ['CHEAPEST', 'Lowest final cost'],
    ['FASTEST', 'Earliest feasible start'],
    ['BALANCED', 'Best weighted trade-off'],
  ];
  goals.forEach((g, i) => {
    const y = 186 + i * 105;
    line(s, 760, y + 36, 72, 0, '#326641', 2);
    txt(s, g[0], 850, y, 220, 34, 18, i === 0 ? C.green : C.white, true);
    txt(s, g[1], 850, y + 38, 300, 32, 15, C.gray, false);
  });
  txt(s, 'Actual station and grid data determine whether objectives share the same best window.', 98, 630, 1080, 34, 17, C.gray, false, 'center');
  addNote(s, 'The optimizer is deterministic and explainable. It ranks feasible candidates by renewable share, final price, start time, carbon intensity, and grid load. It does not force artificial differences when the source data lacks meaningful variation.');
}

// 6. Live scenario
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Verified optimization scenario', 6, 'Surat station, 35 kWh request, ₹50 base tariff, 24-hour flexibility');
  const data = [
    ['FASTEST', '12.72%', '₹48.09', '3.82%', '00:00'],
    ['CHEAPEST', '35.69%', '₹44.65', '10.71%', '10:00'],
    ['BALANCED', '38.01%', '₹44.30', '11.40%', '11:00'],
    ['GREENEST', '38.97%', '₹44.16', '11.69%', '12:00'],
  ];
  txt(s, 'Strategy', 74, 205, 190, 28, 15, C.dim, true);
  txt(s, 'Renewable share', 280, 205, 210, 28, 15, C.dim, true);
  txt(s, 'Rate / kWh', 530, 205, 160, 28, 15, C.dim, true);
  txt(s, 'Discount', 720, 205, 140, 28, 15, C.dim, true);
  txt(s, 'Start', 940, 205, 120, 28, 15, C.dim, true);
  data.forEach((r, i) => {
    const y = 248 + i * 79;
    line(s, 72, y - 12, 1110, 0, C.rule, 1);
    txt(s, r[0], 74, y, 190, 34, 18, r[0] === 'GREENEST' ? C.green : C.white, true);
    txt(s, r[1], 280, y, 180, 34, 20, C.white, true);
    const pct = Number(r[1].replace('%', ''));
    s.shapes.add({ geometry: 'rect', position: { left: 398, top: y + 7, width: pct * 2.2, height: 14 }, fill: C.green, line: { fill: C.green, width: 0 }, borderRadius: 7 });
    txt(s, r[2], 530, y, 160, 34, 20, C.white, true);
    txt(s, r[3], 720, y, 140, 34, 20, C.green, true);
    txt(s, r[4], 940, y, 120, 34, 20, C.white, true);
  });
  stat(s, '26.25 pp', 'renewable-share gain: fastest to greenest', 112, 584, 350, C.green);
  stat(s, '₹3.93/kWh', 'rate reduction: fastest to greenest', 486, 584, 340, C.lime);
  stat(s, '₹137.55', 'estimated saving on 35 kWh', 852, 584, 320, C.white);
  addNote(s, 'Evidence captured from the running local API on 12 September 2026. Data mode: FORECAST. Source label: India Energy Atlas regional aggregate fuel mix. This scenario demonstrates the current algorithm; it does not guarantee the same savings for every station or day.');
}

// 7. Pricing
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Transparent renewable pricing', 7, 'Drivers see why the rate changed before they confirm');
  txt(s, 'BASE TARIFF', 86, 238, 210, 30, 16, C.dim, true);
  txt(s, '₹50.00', 86, 280, 220, 64, 43, C.white, true);
  txt(s, '×', 320, 286, 50, 50, 34, C.dim, true, 'center');
  txt(s, 'RENEWABLE FACTOR', 388, 238, 250, 30, 16, C.green, true);
  txt(s, '0.8831', 388, 280, 220, 64, 43, C.green, true);
  txt(s, '=', 648, 286, 50, 50, 34, C.dim, true, 'center');
  txt(s, 'LOCKED RATE', 720, 238, 240, 30, 16, C.lime, true);
  txt(s, '₹44.16', 720, 280, 260, 64, 43, C.lime, true);
  line(s, 84, 378, 1020, 0, C.rule, 2);
  const rules = [
    ['More renewable energy', 'larger discount'],
    ['Grid stress or capacity risk', 'smaller incentive or defer option'],
    ['Booking confirmation', 'price and source snapshot locked'],
  ];
  rules.forEach((r, i) => {
    const y = 420 + i * 64;
    dot(s, 92, y + 9, 11, i === 1 ? C.amber : C.green);
    txt(s, r[0], 122, y, 330, 32, 18, C.white, true);
    txt(s, r[1], 490, y, 550, 32, 18, C.gray, false);
  });
  box(s, 84, 630, 1030, 40, '#0D2415', 14, '#245B34');
  txt(s, 'Policy stays configurable, bounded, auditable, and visible to the driver.', 110, 638, 980, 24, 17, C.green, true, 'center');
  addNote(s, 'The current build applies a continuous renewable-share discount with safety caps. A production policy should also incorporate grid congestion, station utilization, regulator-approved limits, and operator incentives.');
}

// 8. Roles
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Three coordinated decisions', 8, 'Each role acts on the same renewable and capacity outlook');
  const roles = [
    ['DRIVER', 'Shares flexibility', 'Chooses energy need, ready-by time and preference', 'Receives a cheaper, cleaner feasible slot'],
    ['STATION OPERATOR', 'Manages local capacity', 'Publishes charger status, tariff, solar and storage availability', 'Uses renewable supply without overloading the site'],
    ['GRID OPERATOR', 'Shapes regional demand', 'Publishes limits, congestion windows and defer incentives', 'Moves aggregated charging away from grid stress'],
  ];
  roles.forEach((r, i) => {
    const x = 70 + i * 402;
    box(s, x, 194, 360, 390, i === 1 ? '#101B12' : C.panel, 24, i === 1 ? '#2A7440' : C.rule);
    txt(s, r[0], x + 24, 220, 312, 30, 15, C.green, true);
    txt(s, r[1], x + 24, 270, 310, 54, 25, C.white, true);
    line(s, x + 24, 340, 290, 0, C.rule, 1);
    txt(s, r[2], x + 24, 365, 305, 82, 16, C.gray, false);
    txt(s, r[3], x + 24, 476, 305, 74, 16, C.white, true);
  });
  txt(s, 'Shared outcome: more EV energy served when renewable supply is available.', 126, 628, 1020, 34, 23, C.green, true, 'center');
  addNote(s, 'The mobile app remains customer focused. Station operators and administrators use the web portal. For the hackathon, the administrator represents the grid-management persona; a dedicated production grid role remains a planned authorization enhancement.');
}

// 9. Architecture
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Implementation architecture', 9, 'A renewable intelligence layer extends the existing EV platform');
  const cols = [
    [82, 'EXPERIENCE', ['Expo mobile app', 'React web portal']],
    [366, 'SECURE API', ['JWT + role access', 'Validated REST contracts']],
    [650, 'INTELLIGENCE', ['Forecast + cache', 'Optimizer + pricing']],
    [934, 'SYSTEM OF RECORD', ['MongoDB Atlas', 'Audit + booking snapshots']],
  ];
  cols.forEach((c, i) => {
    box(s, c[0], 226, 236, 286, i === 2 ? '#102619' : C.panel, 24, i === 2 ? '#2A7440' : C.rule);
    txt(s, c[1], c[0] + 22, 250, 192, 28, 14, C.green, true);
    txt(s, c[2][0], c[0] + 22, 318, 192, 42, 20, C.white, true);
    txt(s, c[2][1], c[0] + 22, 390, 192, 42, 18, C.gray, false);
    if (i < cols.length - 1) line(s, c[0] + 236, 370, 48, 0, '#326641', 3);
  });
  txt(s, 'India Energy Atlas regional fuel-mix profile', 650, 548, 520, 32, 17, C.white, true, 'center');
  line(s, 790, 512, 0, 30, C.green, 2);
  txt(s, 'Timeouts, numeric validation, caching and explicit FORECAST labels protect trust and API quota.', 104, 626, 1060, 38, 17, C.gray, false, 'center');
  addNote(s, 'Current stack: Expo/React Native, React/Vite, Java 17 with Spring Boot and Spring Security, and MongoDB Atlas. Renewable provider credentials remain server-side. External data includes timeouts, numeric validation and caching.');
}

// 10. Measurement
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Impact that judges can verify', 10, 'Every accepted recommendation should produce an auditable before-and-after record');
  const measures = [
    ['Renewable kWh utilized', 'Energy delivered × renewable share'],
    ['Demand shifted', 'Optimized load moved from the original window'],
    ['Peak avoided', 'Charging load removed from constrained hours'],
    ['Driver savings', 'Baseline cost minus locked optimized cost'],
    ['Carbon avoided', 'Baseline emissions minus optimized estimate'],
    ['Acceptance rate', 'Accepted green recommendations / offers'],
  ];
  measures.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 82 + col * 584, y = 192 + row * 132;
    txt(s, String(i + 1).padStart(2, '0'), x, y, 54, 42, 21, C.green, true);
    txt(s, m[0], x + 70, y, 430, 36, 21, C.white, true);
    txt(s, m[1], x + 70, y + 42, 430, 40, 16, C.gray, false);
    line(s, x, y + 100, 500, 0, C.rule, 1);
  });
  box(s, 124, 610, 1032, 54, '#0D2415', 16, '#245B34');
  txt(s, 'Success means cleaner charging actually happened, not only that a recommendation appeared.', 150, 620, 980, 30, 19, C.green, true, 'center');
  addNote(s, 'These are proposed product KPIs. The current build calculates expected renewable share, price, total cost, carbon and estimated carbon saved. Production measurement requires session-level energy telemetry and a verified accounting method.');
}

// 11. Roadmap
{
  const s = pres.slides.add(); s.background.fill = C.black;
  title(s, 'Path from MVP to grid-scale orchestration', 11, 'Development follows measurable control-loop maturity');
  const stages = [
    ['NOW', 'Explainable scheduling', 'Four strategies\nDynamic tariff\nPrice lock\nRole dashboards'],
    ['NEXT', 'Automatic flexibility', 'Ready-by charging\nGreen commitment\nAction notifications\nImpact ledger'],
    ['THEN', 'Station energy control', 'Local solar forecast\nBattery state\nImport limits\nSurplus capture'],
    ['SCALE', 'Grid programs', 'Demand-response events\nVerified response\nRegional aggregation\nOperator settlement'],
  ];
  stages.forEach((st, i) => {
    const x = 62 + i * 302;
    box(s, x, 196, 272, 382, i === 0 ? '#102619' : C.panel, 24, i === 0 ? '#2A7440' : C.rule);
    txt(s, st[0], x + 22, 218, 140, 28, 14, i === 0 ? C.lime : C.green, true);
    txt(s, st[1], x + 22, 274, 225, 68, 23, C.white, true);
    txt(s, st[2], x + 22, 370, 225, 150, 17, C.gray, false);
  });
  txt(s, 'Each stage keeps the recommendation explainable and adds stronger proof of renewable utilization.', 104, 628, 1080, 34, 18, C.white, true, 'center');
  addNote(s, 'Roadmap features are clearly separated from the implemented MVP. Physical charger control, utility settlement, certified carbon accounting and station battery orchestration are not claimed as completed today.');
}

// 12. Close
{
  const s = pres.slides.add(); s.background.fill = C.black;
  txt(s, 'PLUGIN', 70, 50, 170, 34, 19, C.green, true);
  txt(s, 'A practical path to\nrenewable-first charging', 70, 150, 780, 128, 48, C.white, true);
  txt(s, 'A driver sees a better time and price. A station uses cleaner supply. The grid receives flexible demand when it can support it.', 74, 314, 650, 104, 22, C.gray, false);
  box(s, 780, 132, 392, 388, '#102619', 30, '#2A7440');
  stat(s, '4', 'explainable charging strategies', 824, 178, 300, C.green);
  stat(s, '24 h', 'optimization horizon', 824, 292, 300, C.lime);
  stat(s, '146', 'backend tests passing', 824, 406, 300, C.white);
  box(s, 74, 536, 620, 62, '#0D2415', 18, '#245B34');
  txt(s, 'Tomorrow’s demo proves the full loop from forecast to measured impact', 96, 550, 576, 34, 18, C.green, true, 'center');
  txt(s, "HackOut'26 PLUGIN renewable optimization", 74, 638, 560, 28, 15, C.dim, false);
  addNote(s, 'Close with the verified product loop. The existing EV platform supplies identity, stations, bookings, sessions and billing. The renewable layer decides when and where charging creates more value.');
}

const { applyPresentationChartFont, finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
void applyPresentationChartFont;

const stagingDir = path.join(workspaceDir, '.codex-finalizer');
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, 'PLUGIN_HackOut26_candidate.pptx');
await (await PresentationFile.exportPptx(pres)).save(candidatePath);

await finalizePresentation({
  explicitTotalSlideCount: 12,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  materializeLiteralChartWorkbooks: false,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit'],
  fontPolicy: { basis: 'design', families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, 'PLUGIN_HackOut26.validation.v2.json'),
});

const previewDir = path.join(buildDir, 'rendered');
await fs.mkdir(previewDir, { recursive: true });
for (let i = 0; i < pres.slides.length; i++) {
  const slide = pres.slides.getItemAt(i);
  const png = await pres.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(previewDir, `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
}

console.log(JSON.stringify({ finalPath, previewDir, slideCount: pres.slides.length }));
