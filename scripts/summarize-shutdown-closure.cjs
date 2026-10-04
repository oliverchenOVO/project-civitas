/* eslint-disable @typescript-eslint/no-require-imports -- diagnostic CommonJS tool */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const qa = path.join(root, 'artifacts/qa');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const cases = [];
for (const name of fs.readdirSync(qa).filter((n) => n.startsWith('exit-closure-')).sort()) {
  const file = path.join(qa, name, 'result.json');
  if (!fs.existsSync(file)) continue;
  const data = read(file);
  const runs = Array.isArray(data) ? data : [data];
  const first = runs[0];
  const startup = first.lifecycleEvents?.find((e) => e.event === 'startup');
  const ownerPath = path.join(qa, name, 'playwright-owner.json');
  const owner = fs.existsSync(ownerPath) ? read(ownerPath) : null;
  cases.push({
    case: first.case, target: first.target, launcher: first.launcher,
    gpuOff: first.gpuOff ?? false, sandboxOff: first.sandboxOff ?? false,
    versions: startup?.versions ?? owner?.electron?.versions ?? null, packaged: startup?.isPackaged ?? null,
    executable: first.executable ?? null,
    executableSha256: first.executable && fs.existsSync(first.executable) ? hash(first.executable) : null,
    completed: runs.length, passed: runs.filter((r) => r.passed).length,
    failed: runs.filter((r) => !r.passed).length,
    rawPath: path.relative(root, file), rawSha256: hash(file),
    runs: runs.map((r) => ({
      iteration: r.iteration, rootPid: r.rootPid, mainPid: r.mainPid,
      launched: r.launched, passed: r.passed, lifecycleComplete: r.lifecycleComplete ?? null,
      kernelExited: r.kernelExited ?? (r.mainExited && r.allChildrenExited),
      cimAbsent: r.cimAbsent ?? (r.cimRowsAfterHandleRelease == null ? null : r.cimRowsAfterHandleRelease === 0),
      windowClosed: r.windowClosed, kernelExitUpperBoundMs: r.kernelExitUpperBoundMs,
      finalCimAbsenceCheckMs: r.finalCimAbsenceCheckMs,
      forceCleanupPerformed: r.forceCleanupPerformed,
      remainingProcesses: r.remainingProcesses,
      cimRowsBeforeCleanup: r.cimRowsBeforeCleanup,
      threadEvidenceBeforeCleanup: r.threadEvidenceBeforeCleanup,
      processJobs: r.samples?.find((s) => s.label === 'before-close')?.processes.map(
        (p) => ({ pid: p.pid, role: p.role, inJob: p.inJob, querySucceeded: p.jobQuerySucceeded }),
      ),
    })),
  });
}
const result = {
  collectedAt: new Date().toISOString(),
  criterion: 'Real owned native window; WM_CLOSE; all tracked kernel handles signaled; owned identities absent after observer handle release; within 10000ms; no forced cleanup. Lifecycle is a separate observation, not a substitute.',
  environment: read(path.join(root, 'artifacts/shutdown-closure-environment.json')),
  probeSha256: hash(path.join(root, 'scripts/repro-electron-quit.cjs')),
  harnessSha256: hash(path.join(root, 'scripts/shutdown-closure.ps1')),
  productionRuntimeChanged: false,
  cases,
};
fs.writeFileSync(path.join(root, 'artifacts/shutdown-closure-matrix.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(cases.map((c) => ({ case: c.case, completed: c.completed, pass: c.passed, fail: c.failed }))));
