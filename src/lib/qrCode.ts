/**
 * Zero-dependency QR Code (ISO/IEC 18004 Model 2) Generator for Little Monkey Café
 * Generates genuine, camera-scannable QR codes for table entry & print assets.
 */

import React from 'react';

const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP_TABLE[i] = x;
  EXP_TABLE[i + 255] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11D : 0);
}
LOG_TABLE[0] = 0;

function gmult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gmult(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], eccLength: number): number[] {
  const gen = rsGeneratorPoly(eccLength);
  const res = new Array(data.length + eccLength).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const lead = res[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gmult(gen[j], lead);
      }
    }
  }
  return res.slice(data.length);
}

interface VersionInfo {
  version: number;
  maxBytes: number;
  total: number;
  ecPerBlock: number;
  b1: number;
  d1: number;
  b2: number;
  d2: number;
}

const VERSION_TABLE: Array<VersionInfo | null> = [
  null,
  { version: 1, maxBytes: 14, total: 26, ecPerBlock: 10, b1: 1, d1: 16, b2: 0, d2: 0 },
  { version: 2, maxBytes: 26, total: 44, ecPerBlock: 16, b1: 1, d1: 28, b2: 0, d2: 0 },
  { version: 3, maxBytes: 42, total: 70, ecPerBlock: 26, b1: 1, d1: 44, b2: 0, d2: 0 },
  { version: 4, maxBytes: 62, total: 100, ecPerBlock: 18, b1: 2, d1: 32, b2: 0, d2: 0 },
  { version: 5, maxBytes: 84, total: 134, ecPerBlock: 24, b1: 2, d1: 43, b2: 0, d2: 0 },
  { version: 6, maxBytes: 106, total: 172, ecPerBlock: 16, b1: 4, d1: 27, b2: 0, d2: 0 },
  { version: 7, maxBytes: 122, total: 196, ecPerBlock: 18, b1: 4, d1: 31, b2: 0, d2: 0 },
  { version: 8, maxBytes: 152, total: 242, ecPerBlock: 22, b1: 2, d1: 38, b2: 2, d2: 39 },
  { version: 9, maxBytes: 180, total: 292, ecPerBlock: 22, b1: 3, d1: 36, b2: 2, d2: 37 },
  { version: 10, maxBytes: 213, total: 346, ecPerBlock: 26, b1: 4, d1: 43, b2: 1, d2: 44 },
];

const ALIGNMENT_LOCATIONS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

const FORMAT_INFO_M: number[] = [
  0x5412,
  0x5125,
  0x5E7C,
  0x5B4B,
  0x45F9,
  0x40CE,
  0x4F97,
  0x4AA0,
];

// 18-bit BCH Version Information for Version 7 to 10
const VERSION_INFO_BITS: Array<number | null> = [
  null, null, null, null, null, null, null,
  0x07C94, // Version 7
  0x085BC, // Version 8
  0x09A99, // Version 9
  0x0A4D3, // Version 10
];

export interface QRCodeData {
  matrix: number[][];
  size: number;
  version: number;
}

export function generateQRCode(text: string): QRCodeData {
  const encoder = new TextEncoder();
  const rawBytes = Array.from(encoder.encode(text));
  const length = rawBytes.length;

  let versionInfo: VersionInfo | null = null;
  for (let v = 1; v < VERSION_TABLE.length; v++) {
    const info = VERSION_TABLE[v];
    if (info && length <= info.maxBytes) {
      versionInfo = info;
      break;
    }
  }

  if (!versionInfo) {
    throw new Error(`Data payload too long (${length} bytes). Max capacity supported is 213 bytes.`);
  }

  const { version, total, ecPerBlock, b1, d1, b2, d2 } = versionInfo;
  const dataCapacity = b1 * d1 + b2 * d2;

  // Build bitstream: 0100 (byte mode) + 8-bit length + data
  const bits: number[] = [];
  const appendBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  appendBits(0b0100, 4);
  appendBits(length, 8);
  for (const b of rawBytes) {
    appendBits(b, 8);
  }

  // Terminator
  const requiredBits = dataCapacity * 8;
  const termLen = Math.min(4, Math.max(0, requiredBits - bits.length));
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes 0xEC and 0x11
  const padPatterns = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < requiredBits) {
    appendBits(padPatterns[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to data codewords
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    dataBytes.push(b);
  }

  // Block partitioning and Reed-Solomon computation
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let byteOffset = 0;

  for (let i = 0; i < b1; i++) {
    const chunk = dataBytes.slice(byteOffset, byteOffset + d1);
    blocks.push(chunk);
    ecBlocks.push(rsRemainder(chunk, ecPerBlock));
    byteOffset += d1;
  }
  for (let i = 0; i < b2; i++) {
    const chunk = dataBytes.slice(byteOffset, byteOffset + d2);
    blocks.push(chunk);
    ecBlocks.push(rsRemainder(chunk, ecPerBlock));
    byteOffset += d2;
  }

  // Interleave data codewords
  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(d1, d2);
  for (let c = 0; c < maxDataLen; c++) {
    for (let b = 0; b < blocks.length; b++) {
      if (c < blocks[b].length) {
        finalCodewords.push(blocks[b][c]);
      }
    }
  }

  // Interleave EC codewords
  for (let c = 0; c < ecPerBlock; c++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      finalCodewords.push(ecBlocks[b][c]);
    }
  }

  // Construct matrix
  const size = 17 + version * 4;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const isReserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (r: number, c: number, val: number, res = true) => {
    matrix[r][c] = val;
    if (res) isReserved[r][c] = true;
  };

  // Finder patterns
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
              setModule(nr, nc, 1);
            } else {
              setModule(nr, nc, 0);
            }
          } else {
            setModule(nr, nc, 0); // Separator
          }
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0 ? 1 : 0);
    setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_LOCATIONS[version] || [];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const ar = alignCoords[i];
      const ac = alignCoords[j];
      // Only skip if overlapping one of the three finder patterns (including 1-module separator)
      const inTL = ar <= 8 && ac <= 8;
      const inTR = ar <= 8 && ac >= size - 9;
      const inBL = ar >= size - 9 && ac <= 8;
      if (inTL || inTR || inBL) continue;

      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isEdge = Math.max(Math.abs(r), Math.abs(c)) === 2;
          const isCenter = r === 0 && c === 0;
          setModule(ar + r, ac + c, isEdge || isCenter ? 1 : 0);
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, 1);

  // Reserve format area
  for (let i = 0; i < 9; i++) {
    if (!isReserved[8][i]) isReserved[8][i] = true;
    if (!isReserved[i][8]) isReserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!isReserved[8][size - 1 - i]) isReserved[8][size - 1 - i] = true;
    if (!isReserved[size - 1 - i][8]) isReserved[size - 1 - i][8] = true;
  }

  // Reserve version info area for Version 7+
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        isReserved[size - 11 + j][i] = true;
        isReserved[i][size - 11 + j] = true;
      }
    }
  }

  // Place data bits in matrix (Right-to-left 2-column zigzag)
  const dataBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((cw >>> i) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isReserved[r][c]) {
          matrix[r][c] = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0;
        }
      }
    }
    upwards = !upwards;
  }

  // Apply Mask Pattern 0: (row + col) % 2 === 0
  const maskPattern = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isReserved[r][c]) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] = matrix[r][c] === 1 ? 0 : 1;
        }
      }
    }
  }

  // Write format info bits (15 bits for ECC M + mask 0 = 0x5412)
  const formatBits = FORMAT_INFO_M[maskPattern];
  const formatMapTL = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >>> (14 - i)) & 1;
    const [r, c] = formatMapTL[i];
    matrix[r][c] = bit;
  }

  for (let i = 0; i < 7; i++) {
    const bit = (formatBits >>> (14 - i)) & 1;
    matrix[size - 1 - i][8] = bit;
  }
  for (let i = 0; i < 8; i++) {
    const bit = (formatBits >>> (7 - i)) & 1;
    matrix[8][size - 8 + i] = bit;
  }

  // Write version info bits for Version 7+
  if (version >= 7 && VERSION_INFO_BITS[version]) {
    const vBits = VERSION_INFO_BITS[version]!;
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >>> i) & 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      // Bottom-left block: rows (size - 11 + c), cols r
      matrix[size - 11 + c][r] = bit;
      // Top-right block: rows r, cols (size - 11 + c)
      matrix[r][size - 11 + c] = bit;
    }
  }

  return { matrix, size, version };
}

export function generateQRCodeSVG(text: string, options: {
  quietZone?: number;
  darkColor?: string;
  lightColor?: string;
  sizePx?: number;
} = {}): string {
  const { quietZone = 2, darkColor = '#000000', lightColor = '#FFFFFF', sizePx = 200 } = options;
  const { matrix, size } = generateQRCode(text);
  const totalSize = size + quietZone * 2;

  let pathD = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const cx = c + quietZone;
        const cy = r + quietZone;
        pathD += `M${cx},${cy}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
  <rect width="${totalSize}" height="${totalSize}" fill="${lightColor}" />
  <path d="${pathD.trim()}" fill="${darkColor}" />
</svg>`;
}

export function QRCodeView({
  value,
  size = 180,
  darkColor = '#000000',
  lightColor = '#FFFFFF',
  quietZone = 2,
  className = '',
  alt = 'Table QR Code',
}: {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  quietZone?: number;
  className?: string;
  alt?: string;
}) {
  const { matrix, size: matrixSize } = React.useMemo(() => generateQRCode(value), [value]);
  const totalSize = matrixSize + quietZone * 2;

  const pathD = React.useMemo(() => {
    let d = '';
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r][c] === 1) {
          const cx = c + quietZone;
          const cy = r + quietZone;
          d += `M${cx},${cy}h1v1h-1z `;
        }
      }
    }
    return d.trim();
  }, [matrix, matrixSize, quietZone]);

  return React.createElement(
    'svg',
    {
      role: 'img',
      'aria-label': alt,
      className,
      viewBox: `0 0 ${totalSize} ${totalSize}`,
      width: size,
      height: size,
      shapeRendering: 'crispEdges',
      style: { display: 'block', maxWidth: '100%', height: 'auto', background: lightColor },
    },
    React.createElement('rect', { width: totalSize, height: totalSize, fill: lightColor }),
    React.createElement('path', { d: pathD, fill: darkColor })
  );
}

export default QRCodeView;
