import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateLocaliPdf } from '../src/lib/generateLocaliPdf.js';

const loadImage = async path => {
  const bytes = fs.readFileSync(new URL(`../public${path}`, import.meta.url));
  return { data: `data:image/png;base64,${bytes.toString('base64')}`, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
export const exampleVenues = [
  { id:'K001', name:'BAR ESEMPIO', city:'Manfredonia', machines:[
    { name:'APEX', level:4250, fondo:5000, last_update:'2026-10-02T09:20:00Z' },
    { name:'TWIN', level:1800, fondo:2500, last_update:'2026-10-02T09:25:00Z' },
  ], slots:[{ model:'QUEEN 1', quantity:2 }, { model:'QUEEN 2', quantity:1 }, { model:'GAMINATOR', quantity:2 }] },
  { id:'K002', name:'SALA ESEMPIO', city:'Vico del Gargano', machines:[
    { name:'HAMMER', level:3750, fondo:4500, last_update:'2026-10-02T09:40:00Z' },
  ], slots:[{ model:'QUEEN 1', quantity:1 }, { model:'JACK', quantity:2 }, { model:'MARIK TOUCH', quantity:1 }] },
];
test('PDF locali con parco slot e font incorporati, senza modificare i dati', async () => {
  const snapshot = JSON.stringify(exampleVenues);
  const doc = await generateLocaliPdf(exampleVenues, { loadImage });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.getFontList().Manrope.includes('bold'));
  assert.equal(JSON.stringify(exampleVenues), snapshot);
  if (process.env.LOCALI_PDF_QA) doc.save(`${process.env.LOCALI_PDF_QA}/locali184.pdf`);
});
test('PDF locali: fascia slot dopo ultimo Change anche con cambio pagina e modelli lunghi', async () => {
  const venue = { ...exampleVenues[0], machines:Array.from({ length:8 }, (_, i) => ({ ...exampleVenues[0].machines[0], name:i % 2 ? 'TWIN' : 'APEX' })), slots:Array.from({ length:6 }, (_, i) => ({ model:`MODELLO DIMOSTRATIVO CON NOME LUNGO ${i + 1}`, quantity:i + 1 })) };
  const doc = await generateLocaliPdf([venue, { ...exampleVenues[1], slots:[] }], { loadImage });
  assert.equal(doc.getNumberOfPages(), 2);
  if (process.env.LOCALI_PDF_QA) doc.save(`${process.env.LOCALI_PDF_QA}/locali184-pages.pdf`);
  await assert.rejects(generateLocaliPdf([], { loadImage }), /Nessun locale/);
  await assert.rejects(generateLocaliPdf([{ ...venue, slots:[{ model:'JACK', quantity:-1 }] }], { loadImage }), /non validi/);
});
