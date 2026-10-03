/* eslint-disable @typescript-eslint/no-require-imports -- diagnostic CommonJS tool */
const fs = require('node:fs');
const cases = [
  'baseline-minimal',
  'baseline-unpacked',
  'baseline-portable',
  'current-normal',
  'current-gpu-off',
  'console-parent',
  'detached-parent',
  'playwright-parent',
  'minimal-packaged',
  'minimal-exit-mode',
  'adjacent-39',
  'acceptance-unpacked',
  'acceptance-portable',
];
const raw = [];
for (const name of cases) {
  const data = JSON.parse(
    fs.readFileSync(`artifacts/qa/exit-${name}/result.json`, 'utf8').replace(/^\uFEFF/, ''),
  );
  raw.push(...(Array.isArray(data) ? data : [data]));
}
fs.writeFileSync(
  'artifacts/qa/exit-process-tree.json',
  JSON.stringify(
    raw.filter((row) => row.case.startsWith('baseline-')),
    null,
    2,
  ),
);
const compact = (row) => {
  const startup = row.lifecycleEvents.find((event) => event.event === 'startup');
  const topology = row.samples.find((sample) => sample.label === 'before-close').processes;
  return {
    case: row.case,
    iteration: row.iteration,
    target: row.target,
    launcher: row.launcher,
    electronVersion: startup?.versions.electron || '38.8.6',
    isPackaged: startup?.isPackaged ?? true,
    gpuOff: row.gpuOff,
    exitMode: row.exitMode,
    launch: row.launched,
    windowClosed: row.windowClosed,
    mainExited: row.mainExited,
    allChildrenExited: row.allChildrenExited,
    passed: row.passed,
    exitLatencyUpperBoundMs: row.exitLatencyUpperBoundMs,
    finalCimAbsenceCheckMs: row.finalCimAbsenceCheckMs,
    remainingProcesses: row.remainingProcesses.map((process) => ({
      pid: process.pid,
      role: process.role,
      name: process.name,
    })),
    forceCleanupPerformed: row.forceCleanupPerformed ?? false,
    lifecycleEvents: row.lifecycleEvents.filter((event) => event.event !== 'startup'),
    topology: topology.map((process) => ({
      pid: process.pid,
      ppid: process.ppid,
      role: process.role,
      name: process.name,
      startTime: process.startTime,
    })),
    kernelTerminalWhileCimPresent: row.samples.some((sample) =>
      sample.processes.some(
        (process) => process.cimPresent && process.kernelSignaled && process.exitCode === 0,
      ),
    ),
  };
};
const results = raw.map(compact);
const matrix = {
  sameMachine: true,
  currentVersion: '38.8.6',
  latestPatchInMajor: '38.8.6',
  latestPatchIsCurrent: true,
  latestPatchSource: 'npm registry: pnpm view electron@38 version --json',
  timeoutSeconds: 10,
  results: results.filter((row) => ['current-normal', 'adjacent-39'].includes(row.case)),
};
fs.writeFileSync('artifacts/qa/electron-exit-matrix.json', JSON.stringify(matrix, null, 2));
const regression = JSON.parse(fs.readFileSync('artifacts/qa/exit-regression.json', 'utf8'));
const summary = {
  os: { caption: 'Windows 11 Home', version: '10.0.26200', architecture: 'x64' },
  historicalCause:
    'Undetermined. Previous 60-second failures are not reproduced. Observed terminal process objects retained in CIM do not establish the cause of historical WaitForExit failures.',
  productModified: false,
  productionElectronVersion: '38.8.6',
  secondMachineTested: false,
  matrix,
  results,
  regression: {
    productionPayloadMatchesFreshBuild: regression.productionPayloadMatchesFreshBuild,
    payloadFileCount: regression.files.length,
    benchmarkHashesUnchanged: regression.benchmarkHashesUnchanged,
    stabilityHashesUnchanged: regression.stabilityHashesUnchanged,
    seedCount: regression.seedCount,
  },
};
fs.writeFileSync('artifacts/exit-investigation-summary.json', JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify({
    runs: results.length,
    passes: results.filter((row) => row.passed).length,
    matrixRuns: matrix.results.length,
    acceptance: results
      .filter((row) => row.case.startsWith('acceptance-'))
      .map((row) => ({ case: row.case, iteration: row.iteration, passed: row.passed })),
  }),
);
