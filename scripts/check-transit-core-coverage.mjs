import { readFile } from 'node:fs/promises';
import path from 'node:path';

const summaryPath = path.resolve(
  process.cwd(),
  'packages/transit-core/coverage/coverage-summary.json',
);

const raw = await readFile(summaryPath, 'utf8');
const summary = JSON.parse(raw);
const linePct = Number(summary.total?.lines?.pct ?? 0);

if (linePct < 90) {
  console.error(`Coverage gate failed: transit-core lines ${linePct}% < 90%`);
  process.exit(1);
}

console.log(`Coverage gate passed: transit-core lines ${linePct}%`);
