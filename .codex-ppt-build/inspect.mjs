import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const source = process.argv[2];
const outDir = process.argv[3];
const presentation = await PresentationFile.importPptx(await FileBlob.load(source));
await fs.mkdir(outDir, { recursive: true });
const snapshot = await presentation.inspect({
  kind: 'deck,slide,textbox,shape,image,table,chart,notes,layout',
  include: 'id,slide,name,title,text,textPreview,bbox,bboxUnit,rows,cols,chartType,alt,isPlaceholder,placeholders',
  maxChars: 60000,
});
await fs.writeFile(`${outDir}/inspect.ndjson`, snapshot.ndjson);
console.log(`slides=${presentation.slides.items.length}`);
