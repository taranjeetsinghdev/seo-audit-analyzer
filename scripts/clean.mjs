// Runs automatically before `npm run build` (npm "prebuild" hook): generated
// Next.js output cannot leak into a later build or deployment.
// Honours NEXT_DIST_DIR / DEPLOY_DIR, and refuses to delete anything outside the project folder.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dirs = [process.env.NEXT_DIST_DIR || '.next', process.env.DEPLOY_DIR || 'deploy'];
if (process.argv.includes('--open-next')) dirs.push('.open-next');

for (const dir of dirs) {
  const target = path.resolve(root, dir);
  if (target === root || !target.startsWith(root + path.sep)) {
    console.log(`clean: skipped ${dir} (outside the project)`);
    continue;
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`clean: removed ${path.relative(root, target)}`);
}
