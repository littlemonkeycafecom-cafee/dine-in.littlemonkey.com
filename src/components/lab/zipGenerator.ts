/**
 * Zero-dependency PKZIP generator for bundling Little Monkey Café experimental marker images.
 * Compatible with all standard zip extraction utilities (Windows, macOS, iOS, Android, Linux).
 */

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

/**
 * Creates an uncompressed (Store, method 0) valid ZIP file binary Uint8Array.
 */
export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries: Array<{
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }> = [];

  let currentOffset = 0;
  const localHeaderChunks: Uint8Array[] = [];

  // 1. Build Local File Headers and Data
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = computeCrc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract (2.0)
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method: 0 (Store)
    view.setUint16(10, 0x4821, true); // File last mod time
    view.setUint16(12, 0x5d68, true); // File last mod date
    view.setUint32(14, crc, true); // CRC-32
    view.setUint32(18, data.length, true); // Compressed size
    view.setUint32(22, data.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // Filename length
    view.setUint16(28, 0, true); // Extra field length

    localHeader.set(nameBytes, 30);

    fileEntries.push({
      nameBytes,
      data,
      crc,
      offset: currentOffset,
    });

    localHeaderChunks.push(localHeader);
    localHeaderChunks.push(data);

    currentOffset += localHeader.length + data.length;
  }

  // 2. Build Central Directory Headers
  const centralDirStartOffset = currentOffset;
  const centralDirChunks: Uint8Array[] = [];
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(centralHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // Central directory header signature
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed to extract
    view.setUint16(8, 0, true); // General purpose bit flag
    view.setUint16(10, 0, true); // Compression method: 0
    view.setUint16(12, 0x4821, true); // File last mod time
    view.setUint16(14, 0x5d68, true); // File last mod date
    view.setUint32(16, entry.crc, true); // CRC-32
    view.setUint32(20, entry.data.length, true); // Compressed size
    view.setUint32(24, entry.data.length, true); // Uncompressed size
    view.setUint16(28, entry.nameBytes.length, true); // Filename length
    view.setUint16(30, 0, true); // Extra field length
    view.setUint16(32, 0, true); // Comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal attributes
    view.setUint32(38, 0, true); // External attributes
    view.setUint32(42, entry.offset, true); // Relative offset of local header

    centralHeader.set(entry.nameBytes, 46);

    centralDirChunks.push(centralHeader);
    centralDirSize += centralHeader.length;
  }

  // 3. Build End of Central Directory Record (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, files.length, true); // Total entries on this disk
  eocdView.setUint16(10, files.length, true); // Total entries
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, centralDirStartOffset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // ZIP comment length

  // 4. Concatenate all chunks into final buffer
  const totalLength = centralDirStartOffset + centralDirSize + eocd.length;
  const finalZip = new Uint8Array(totalLength);

  let writePos = 0;
  for (const chunk of localHeaderChunks) {
    finalZip.set(chunk, writePos);
    writePos += chunk.length;
  }
  for (const chunk of centralDirChunks) {
    finalZip.set(chunk, writePos);
    writePos += chunk.length;
  }
  finalZip.set(eocd, writePos);

  return finalZip;
}
