import fs from 'node:fs';
import path from 'node:path';

const [source, target] = process.argv.slice(2);
if (!source || !target) throw new Error('Usage: node scripts/sanitize-glb.mjs <input.glb> <output.glb>');
const input = fs.readFileSync(source);
if (input.toString('ascii', 0, 4) !== 'glTF' || input.readUInt32LE(4) !== 2) throw new Error('Expected glTF 2.0 binary');
const jsonLength = input.readUInt32LE(12);
if (input.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Missing JSON chunk');
const model = JSON.parse(input.toString('utf8', 20, 20 + jsonLength));
function stripMetadata(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'name' || key === 'extras') delete value[key];
    else stripMetadata(child);
  }
}
stripMetadata(model);
const json = Buffer.from(JSON.stringify(model));
const paddedJsonLength = Math.ceil(json.length / 4) * 4;
const tail = input.subarray(20 + jsonLength);
const output = Buffer.alloc(20 + paddedJsonLength + tail.length);
output.write('glTF', 0, 'ascii');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(paddedJsonLength, 12);
output.writeUInt32LE(0x4e4f534a, 16);
json.copy(output, 20);
output.fill(0x20, 20 + json.length, 20 + paddedJsonLength);
tail.copy(output, 20 + paddedJsonLength);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, output);
console.log(`${path.basename(target)}: ${(output.length / 1e6).toFixed(1)} MB`);
