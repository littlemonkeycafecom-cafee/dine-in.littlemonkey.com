import { execSync } from 'node:child_process';

const commits = execSync('git log --format=%H -n 50', { encoding: 'utf8' }).trim().split('\n');

for (const hash of commits) {
  try {
    const msg = execSync(`git log -1 --format=%s ${hash}`, { encoding: 'utf8' }).trim();
    const diff = execSync(`git show ${hash} --stat`, { encoding: 'utf8' });
    if (msg.toLowerCase().includes('signature') || msg.toLowerCase().includes('featured') || msg.toLowerCase().includes('hero')) {
      console.log(hash.slice(0, 7), msg);
    }
  } catch (e) {}
}
