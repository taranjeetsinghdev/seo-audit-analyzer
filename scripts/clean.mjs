// Runs automatically before `npm run build` (npm "prebuild" hook): the same as `rm -rf .next deploy`,
// so every build starts clean and a stale chunk can never end up in ./deploy.
// Honours NEXT_DIST_DIR / DEPLOY_DIR, and refuses to delete anything outside the project folder.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
for (const dir of [process.env.NEXT_DIST_DIR || '.next', process.env.DEPLOY_DIR || 'deploy']) {
  const target = path.resolve(root, dir);
  if (target === root || !target.startsWith(root + path.sep)) {
    console.log(`clean: skipped ${dir} (outside the project)`);
    continue;
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`clean: removed ${path.relative(root, target)}`);
}
