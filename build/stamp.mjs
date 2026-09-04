// Shared build stamp. Its own module so importing it does not drag in the
// side effects of a deploy script.
import { execSync } from 'node:child_process';

// Date first, because that is what you actually compare when asking "is my
// phone on the new build?". The commit is there for tracing it back.
export function buildStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const when = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  let sha = '';
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    /* not a repo, or git unavailable — the date alone still identifies it */
  }
  return sha ? `${when} · ${sha}` : when;
}
