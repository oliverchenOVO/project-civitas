import type { Browser, ElectronApplication } from 'playwright';

const attempted = new WeakMap<object, Promise<void>>();

// A stalled native close is a failed QA run, never an unbounded wait or a
// forced-exit pass. The separate WM_CLOSE gate verifies kernel/CIM absence.
function closeTestSurface(app: Pick<ElectronApplication, 'close'>, name: string): Promise<void> {
  const previous = attempted.get(app);
  if (previous) return previous;
  const operation = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        app.close(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Normal ${name} close exceeded 10 seconds; QA failed; no force kill`)),
            10000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  })();
  attempted.set(app, operation);
  return operation;
}

export function closeNativeTestApp(app: ElectronApplication): Promise<void> {
  return closeTestSurface(app, 'native');
}

export function closeBrowserTestSurface(browser: Browser): Promise<void> {
  return closeTestSurface(browser, 'browser');
}
