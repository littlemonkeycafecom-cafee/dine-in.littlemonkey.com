import fs from 'node:fs';

const width = 360;
const height = 64;
const cornerR = 28;
const centerX = width / 2; // 180
const scoopR = 36;
const scoopDepth = 34;

// Smooth scoop path using cubic beziers:
// Start from top-left after corner: (cornerR, 0) -> (180 - 48, 0)
// Curve down to (180, scoopDepth): C (180 - 24, 0), (180 - 22, scoopDepth), (180, scoopDepth)
// Curve up to (180 + 48, 0): C (180 + 22, scoopDepth), (180 + 24, 0), (180 + 48, 0)
// Line to (width - cornerR, 0)
// Corner arc to (width, cornerR)
// Line to (width, height - cornerR)
// Corner arc to (width - cornerR, height)
// Line to (cornerR, height)
// Corner arc to (0, height - cornerR)
// Line to (0, cornerR)
// Corner arc to (cornerR, 0)

const pathData = `
M ${cornerR},0
L ${centerX - 46},0
C ${centerX - 24},0 ${centerX - 22},${scoopDepth} ${centerX},${scoopDepth}
C ${centerX + 22},${scoopDepth} ${centerX + 24},0 ${centerX + 46},0
L ${width - cornerR},0
A ${cornerR},${cornerR} 0 0,1 ${width},${cornerR}
L ${width},${height - cornerR}
A ${cornerR},${cornerR} 0 0,1 ${width - cornerR},${height}
L ${cornerR},${height}
A ${cornerR},${cornerR} 0 0,1 0,${height - cornerR}
L 0,${cornerR}
A ${cornerR},${cornerR} 0 0,1 ${cornerR},0
Z
`.trim().replace(/\s+/g, ' ');

console.log('Path data:', pathData);
