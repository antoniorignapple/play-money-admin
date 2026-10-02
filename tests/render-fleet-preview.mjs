import { generateFleetPdf } from '../src/lib/generateFleetPdf.js';
import fs from 'node:fs';
fs.mkdirSync('output/pdf',{recursive:true});
const rows=[
 {name:'VOLKSWAGEN CADDY',plate:'AA123BB',reading:{km:163450,date:'2026-10-02'}},
 {name:'FIAT FIORINO',plate:'CC456DD',reading:{km:98420,date:'2026-10-01'}},
 {name:'FIAT DUCATO',plate:'EE789FF',reading:{km:215730,date:'2026-09-30'}},
 {name:'PEUGEOT PARTNER',plate:'GG012HH',reading:{km:72610,date:'2026-10-02'}},
 {name:'RENAULT KANGOO',plate:'II345JJ',reading:null},
];
generateFleetPdf(rows,'2026-10-02').save('output/pdf/Anteprima_PDF_Mezzi_18_2.pdf');
console.log('Anteprima creata con dati dimostrativi.');
