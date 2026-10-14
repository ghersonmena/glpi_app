// Copia a public/ocr los archivos del OCR (Tesseract) para servirlos desde la propia app,
// sin depender de un CDN: el worker, el motor (WebAssembly) y los datos del idioma inglés.
// Se ejecuta solo antes de `npm run dev` y `npm run build` (predev / prebuild).
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Motor solo-LSTM; el navegador elige la variante según lo que soporte (relaxed SIMD, SIMD o básica)
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  // Modelo "best_int": buena precisión con tamaño moderado (~3 MB)
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz']
];

for (const [from, to] of files) {
  const src = join(root, from);
  const dest = join(out, to);
  if (!existsSync(src)) {
    console.error(`[ocr] Falta ${from}: ejecuta npm install`);
    process.exit(1);
  }
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
  copyFileSync(src, dest);
}
console.log('[ocr] Archivos del OCR listos en public/ocr');
