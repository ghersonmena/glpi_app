// Lectura de códigos de barras y de texto (OCR) desde la cámara.
// Las librerías se cargan solo al abrir el escáner, para no hacer más pesada la app.

// Qué tipo de dato espera el campo que se está escaneando
export type ScanFieldKind = 'alphanumeric' | 'uuid';

// ── Recorte del visor ───────────────────────────────────────────────────────

// Recuadro guía, como fracción del visor (centrado)
export const GUIDE = { width: 0.86, height: 0.3 };

// Recorta del video la zona del recuadro guía, en resolución nativa de la cámara.
// El video se muestra con object-fit: cover, así que hay que descontar lo que queda fuera de vista.
// Con zoom digital el video se amplía con CSS desde el centro: lo visible es una zona más chica.
export const cropGuide = (video: HTMLVideoElement, digitalZoom = 1): HTMLCanvasElement | null => {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch) return null;
  const scale = Math.max(cw / vw, ch / vh) * digitalZoom;
  const visibleW = cw / scale;
  const visibleH = ch / scale;
  const offsetX = (vw - visibleW) / 2;
  const offsetY = (vh - visibleH) / 2;
  const sx = offsetX + visibleW * (1 - GUIDE.width) / 2;
  const sy = offsetY + visibleH * (1 - GUIDE.height) / 2;
  const sw = visibleW * GUIDE.width;
  const sh = visibleH * GUIDE.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
};

// ── Códigos de barras ───────────────────────────────────────────────────────

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

let nativeDetector: NativeBarcodeDetector | null | undefined;
let zxingReader: { decodeFromCanvas(canvas: HTMLCanvasElement): { getText(): string } } | null = null;

const BARCODE_FORMATS = [
  'code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e',
  'itf', 'qr_code', 'data_matrix', 'pdf417', 'aztec'
];

// Lector nativo del navegador (Chrome en Android); en iPhone no existe y se usa ZXing
const getNativeDetector = async (): Promise<NativeBarcodeDetector | null> => {
  if (nativeDetector !== undefined) return nativeDetector;
  const Detector = (window as any).BarcodeDetector;
  if (!Detector) return (nativeDetector = null);
  try {
    const supported: string[] = await Detector.getSupportedFormats();
    const formats = BARCODE_FORMATS.filter(f => supported.includes(f));
    nativeDetector = formats.length ? new Detector({ formats }) : null;
  } catch {
    nativeDetector = null;
  }
  return nativeDetector ?? null;
};

/** Busca un código de barras / QR en la imagen. null si no hay. */
export const detectBarcode = async (canvas: HTMLCanvasElement): Promise<string | null> => {
  const native = await getNativeDetector();
  if (native) {
    try {
      const found = await native.detect(canvas);
      const value = found.find(b => b.rawValue?.trim())?.rawValue.trim();
      if (value) return value;
    } catch { /* se intenta con ZXing */ }
  }
  if (!zxingReader) {
    const [{ BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library')
    ]);
    // TRY_HARDER: búsqueda más exhaustiva; ayuda con fotos de cámara (códigos 1D, DataMatrix)
    zxingReader = new BrowserMultiFormatReader(new Map([[DecodeHintType.TRY_HARDER, true]]));
  }
  try {
    return zxingReader.decodeFromCanvas(canvas).getText().trim() || null;
  } catch {
    return null; // NotFoundException: no hay código en este cuadro
  }
};

// ── Texto (OCR) ─────────────────────────────────────────────────────────────

type TesseractWorker = {
  setParameters(params: Record<string, string>): Promise<unknown>;
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

// Archivos servidos por la propia app (scripts/copy-ocr-assets.mjs → public/ocr)
const ocrBase = () => new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;

const getOcrWorker = (): Promise<TesseractWorker> => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
        workerPath: `${ocrBase()}worker.min.js`,
        corePath: ocrBase(),
        langPath: ocrBase(),
        gzip: true
      });
      await worker.setParameters({
        // Texto disperso: etiquetas con varias líneas ("S/N: ...", "P/N: ...")
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:/.#'
      });
      return worker as unknown as TesseractWorker;
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
};

/** Descarga e inicializa el OCR por adelantado (la primera vez tarda unos segundos). */
export const preloadOcr = () => getOcrWorker().then(() => undefined);

// Letras que el OCR confunde con dígitos, para tokens que en realidad son numéricos
const LETTER_TO_DIGIT: Record<string, string> = { O: '0', Q: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8' };

/**
 * Ajusta un valor leído según su naturaleza:
 *  - parte numérica mal leída → corrige letras parecidas a números (O→0, I→1, S→5...)
 *  - alfanumérico → se respeta tal cual (en mayúsculas)
 *  - campo UUID → solo hexadecimal y guiones
 */
export const normalizeScannedValue = (raw: string, kind: ScanFieldKind): string => {
  let value = raw.trim().replace(/\s+/g, '');
  if (kind === 'uuid') {
    value = value.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-F-]/g, '');
    return value;
  }
  // Se revisa por segmentos (separados por - / .): un segmento con dígitos cuyas letras son
  // TODAS confundibles con números (O, I, L, S, B, Z...) es numérico mal leído y se corrige
  // ("PC-OOO1O3" → "PC-000103"). Si tiene alguna letra real, es alfanumérico y no se toca
  // (una serie como 5CD1234ABG se respeta).
  return value.toUpperCase().split(/([-/.])/).map(segment => {
    const letters = segment.match(/[A-Z|]/g) || [];
    const isNumeric = /[0-9]/.test(segment) && letters.length > 0 && letters.every(ch => ch in LETTER_TO_DIGIT);
    return isNumeric ? segment.replace(/[A-Z|]/g, ch => LETTER_TO_DIGIT[ch]) : segment;
  }).join('');
};

// Prefijos comunes en etiquetas que no forman parte del valor
// (el OCR suele leer la "/" de "S/N" como I, l, 1 o |)
// El prefijo se quita si lo sigue un separador o, pegado, un dígito ("INV2012..." → "2012...")
const LABEL_PREFIX = /^(S[/Il1|]{0,2}N|SERIAL|SERIE|P[/Il1|]{0,2}N|MODEL|MOD|INV|NO|N°|#)(?:[:.#-]+|(?=\d))/i;

/**
 * Lee el texto de la imagen y devuelve los posibles valores (identificadores con letras y/o
 * números), ordenados del más probable al menos.
 */
export const recognizeCandidates = async (canvas: HTMLCanvasElement, kind: ScanFieldKind): Promise<string[]> => {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  const trimEdges = (t: string) => t.replace(/^[^0-9A-Za-z]+|[^0-9A-Za-z]+$/g, '');
  const rawTokens = data.text.split(/\s+/).map(trimEdges).filter(Boolean);
  const tokens = rawTokens.map(t => trimEdges(t.replace(LABEL_PREFIX, ''))).filter(Boolean);

  // Penalización por candidato: 0 = lectura corregida y sin prefijo (la más probable);
  // las variantes "tal como se leyó" o con prefijo quedan como alternativas
  const candidates = new Map<string, number>();
  const add = (value: string, penalty: number) => {
    if (!candidates.has(value) || candidates.get(value)! > penalty) candidates.set(value, penalty);
  };
  tokens.forEach(t => {
    add(normalizeScannedValue(t, kind), 0);
    if (kind !== 'uuid') add(t.toUpperCase(), 6);
  });
  if (kind !== 'uuid') rawTokens.forEach(t => add(t.toUpperCase(), 8));
  // UUID partido en varias palabras por el OCR: se unen las piezas hexadecimales
  if (kind === 'uuid') add(normalizeScannedValue(tokens.join(''), kind), 0);

  const isUuid = (v: string) => /^[0-9A-F]{8}-?[0-9A-F]{4}-?[0-9A-F]{4}-?[0-9A-F]{4}-?[0-9A-F]{12}$/.test(v);
  const score = (v: string) => {
    let s = Math.min(v.length, 20);
    if (/[0-9]/.test(v)) s += 10;                   // los identificadores casi siempre llevan dígitos
    if (/[0-9]/.test(v) && /[A-Z]/.test(v)) s += 5; // mezcla típica de series y etiquetas
    if (/^[A-Z]{2,4}-\d{3,}$/.test(v)) s += 15;     // formato de etiqueta (p. ej. PC-000103)
    if (kind === 'uuid' && isUuid(v)) s += 50;
    return s;
  };

  return [...candidates.entries()]
    .filter(([v]) => v.length >= 4 && /[0-9A-Z]/.test(v))
    .sort(([a, pa], [b, pb]) => (score(b) - pb) - (score(a) - pa))
    .map(([v]) => v)
    .slice(0, 6);
};
