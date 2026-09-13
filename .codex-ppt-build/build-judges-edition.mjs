import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = 'E:/study/projects/EV Charging Network Renewable-Optimization Platform';
const SKILL_DIR = 'C:/Users/PRIT/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const RUNTIME_PYTHON = 'C:/Users/PRIT/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE = 'C:/Users/PRIT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';
process.env.RUNTIME_NODE_MODULES = 'C:/Users/PRIT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sourcePath = path.join(workspaceDir, '.codex-ppt-build/normalized-source.pptx');
const originalPath = path.join(workspaceDir, 'PLUGIN_HackOut26_Renewable_EV_Charging_Pitch_Final.pptx');
const stagingDir = path.join(workspaceDir, '.codex-finalizer');
const outputDir = path.join(workspaceDir, 'presentation-output');
const candidatePath = path.join(stagingDir, 'judges-edition-candidate.pptx');
const finalPath = path.join(outputDir, 'PLUGIN_HackOut26_Renewable_EV_Charging_Pitch_Judges_Edition.pptx');

await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const originalCover = presentation.slides.getItem(0);
const originalMobile = presentation.slides.getItem(3);
const landingBytes = await fs.readFile('C:/Users/PRIT/OneDrive/Pictures/Screenshots/Screenshot 2026-09-13 052654.png');
const accountBytes = await fs.readFile('C:/Users/PRIT/AppData/Local/Temp/codex-clipboard-666aa5db-ece1-4dde-8e66-380743391b8a.png');

function addText(slide, name, textValue, position, style) {
  const shape = slide.shapes.add({
    name,
    geometry: 'textbox',
    position,
    fill: 'none',
    line: { fill: 'none', width: 0 },
  });
  shape.text = textValue;
  shape.text.style = {
    typeface: 'Arial',
    autoFit: 'none',
    ...style,
  };
  return shape;
}

function styleEvidenceSlide(slide, number, title, subtitle, imageBytes, alt, footer, notes) {
  slide.background.fill = '#060907';
  addText(slide, 'brand', 'PLUGIN', { left: 62, top: 32, width: 130, height: 28 }, {
    fontSize: 12, bold: true, color: '#37E67A', letterSpacing: 2,
  });
  addText(slide, 'title', title, { left: 62, top: 78, width: 1060, height: 58 }, {
    fontSize: 34, bold: true, color: '#F8FAF9',
  });
  addText(slide, 'subtitle', subtitle, { left: 64, top: 138, width: 1070, height: 34 }, {
    fontSize: 16, color: '#AAB4AF',
  });
  addText(slide, 'slide-number', String(number).padStart(2, '0'), { left: 1172, top: 37, width: 44, height: 24 }, {
    fontSize: 12, color: '#66716B', alignment: 'right',
  });
  slide.images.add({
    blob: imageBytes,
    contentType: 'image/png',
    alt,
    fit: 'contain',
    geometry: 'roundRect',
    borderRadius: 14,
    position: { left: 64, top: 188, width: 1152, height: 430 },
  });
  addText(slide, 'evidence-footer', footer, { left: 64, top: 642, width: 1152, height: 28 }, {
    fontSize: 15, bold: true, color: '#37E67A', alignment: 'center',
  });
  slide.speakerNotes.textFrame.setText(notes);
}

const landingSlide = presentation.slides.add();
styleEvidenceSlide(
  landingSlide,
  2,
  'A working EV platform, ready for renewable intelligence',
  'The customer journey already supports discovery, identity, booking, live sessions and billing.',
  landingBytes,
  'PLUGIN live web landing page with EV charging network interface',
  'The hackathon layer coordinates when and where charging happens.',
  'Product proof: this is the working PLUGIN web experience. The renewable optimization layer extends an existing EV charging platform rather than starting from a static prototype.',
);
landingSlide.moveTo(1);

const accountSlide = presentation.slides.add();
styleEvidenceSlide(
  accountSlide,
  6,
  'One identity layer connects every charging decision',
  'A consistent account journey links the web portal, mobile driver app and role specific operations.',
  accountBytes,
  'PLUGIN account creation screen beside the EV charging network scene',
  'Confirmed identity and role access protect driver, station and grid workflows.',
  'Show that the platform includes a real onboarding path. Email confirmation and role based authorization connect users to the correct mobile or web workflow.',
);
accountSlide.moveTo(5);

const typoHit = await presentation.inspect({ kind: 'textbox', search: 'Automatically hoose', maxChars: 2000 });
for (const line of typoHit.ndjson.split('\n').filter(Boolean)) {
  const record = JSON.parse(line);
  if (record.id?.startsWith('sh/')) presentation.resolve(record.id).text.replace('Automatically hoose', 'Automatically choose');
}

const closeHit = await presentation.inspect({ kind: 'textbox', search: 'Demo will prove the full loop', maxChars: 2000 });
for (const line of closeHit.ndjson.split('\n').filter(Boolean)) {
  const record = JSON.parse(line);
  if (record.id?.startsWith('sh/')) {
    presentation.resolve(record.id).text.replace(
      'Demo will prove the full loop from forecast to measured impact',
      'Live demo: choose a cleaner hour, lower the tariff, lock the booking and record the impact',
    );
  }
}

const allText = await presentation.inspect({
  kind: 'textbox',
  include: 'id,slide,text,bbox',
  maxChars: 40000,
});
for (const line of allText.ndjson.split('\n').filter(Boolean)) {
  const record = JSON.parse(line);
  if (record.id?.startsWith('sh/') && /^\d{2}$/.test((record.text ?? '').trim())
      && Array.isArray(record.bbox) && record.bbox[0] > 1100 && record.bbox[1] < 80) {
    presentation.resolve(record.id).text = String(record.slide).padStart(2, '0');
  }
}

await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
const sourceSha256 = crypto.createHash('sha256').update(await fs.readFile(originalPath)).digest('hex');
await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit'],
  explicitTotalSlideCount: 14,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  sourceTemplatePath: originalPath,
  fontPolicy: { basis: 'reference', families: ['Arial'], referencePath: originalPath, referenceSha256: sourceSha256 },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, 'judges-edition.validation.json'),
});

console.log(finalPath);
