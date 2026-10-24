/* Verify the published source and rebuilt HTML against the supplied bonus download.
 * This is a publication snapshot, not a claim that future changes must be forbidden.
 * After an intentional release change, update the reviewed manifest with new hashes.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = JSON.parse(readFileSync(path.join(root, 'verification/bonus-source-sha256.json'), 'utf8'));
for (const [name, hash] of Object.entries(expected)) {
  const actual = createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex');
  if (actual !== hash) throw new Error(`Publication mismatch: ${name}: ${actual} != ${hash}`);
  console.log(`Verified ${name}`);
}
console.log(`All ${Object.keys(expected).length} publication hashes match.`);
