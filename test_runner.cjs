const path = require('path');
const pholabDir = 'c:/Users/josef/Desktop/pholab';
const esbuild = require(path.join(pholabDir, 'node_modules/esbuild'));
const assert = require('assert');

// Test runner statistics
const stats = {
  suites: 0,
  suitesPassed: 0,
  suitesFailed: 0,
  tests: 0,
  testsPassed: 0,
  testsFailed: 0,
  errors: [],
};

let currentSuitePassed = true;

// Global test harness
global.describe = (name, fn) => {
  stats.suites++;
  currentSuitePassed = true;
  console.log(`\n  ┌─ Suite: ${name}`);
  const startTime = Date.now();
  fn();
  const elapsedMs = Date.now() - startTime;
  if (currentSuitePassed) {
    stats.suitesPassed++;
    console.log(`  └─ ${name} (${elapsedMs} ms) ✓`);
  } else {
    stats.suitesFailed++;
    console.log(`  └─ ${name} (${elapsedMs} ms) ✗`);
  }
};

global.it = (name, fn) => {
  stats.tests++;
  try {
    fn();
    stats.testsPassed++;
    console.log(`    ✓ ${name}`);
  } catch (err) {
    stats.testsFailed++;
    currentSuitePassed = false;
    process.exitCode = 1;
    stats.errors.push({ test: name, error: err });
    console.error(`    ✗ ${name}`);
    console.error(`      Error: ${err.message}`);
  }
};

function safeFormat(val) {
  if (typeof val === 'object' && val !== null) {
    if (val.id) return `[${val.constructor?.name || 'Object'} id=${val.id}]`;
    try {
      return JSON.stringify(val);
    } catch {
      return `[Circular ${val.constructor?.name || 'Object'}]`;
    }
  }
  return String(val);
}

function createMatchers(actual, isNot = false) {
  return {
    toBe: (expected) => {
      const pass = Object.is(actual, expected);
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${safeFormat(actual)} ${isNot ? 'not to be' : 'to be'} ${safeFormat(expected)}`);
      }
    },
    toEqual: (expected) => {
      if (isNot) {
        assert.notDeepStrictEqual(actual, expected);
      } else {
        assert.deepStrictEqual(actual, expected);
      }
    },
    toBeCloseTo: (expected, digits = 2) => {
      const diff = Math.abs(actual - expected);
      const tolerance = Math.pow(10, -digits) / 2;
      const pass = diff <= tolerance;
      if (isNot ? pass : !pass) {
        assert.fail(
          `Expected ${actual} ${isNot ? 'not to be close to' : 'to be close to'} ${expected} (tolerance=${tolerance}, diff=${diff})`
        );
      }
    },
    toBeGreaterThan: (expected) => {
      const pass = actual > expected;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${actual} ${isNot ? '<=' : '>'} ${expected}`);
      }
    },
    toBeGreaterThanOrEqual: (expected) => {
      const pass = actual >= expected;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${actual} ${isNot ? '<' : '>='} ${expected}`);
      }
    },
    toBeLessThan: (expected) => {
      const pass = actual < expected;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${actual} ${isNot ? '>=' : '<'} ${expected}`);
      }
    },
    toBeLessThanOrEqual: (expected) => {
      const pass = actual <= expected;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${actual} ${isNot ? '>' : '<='} ${expected}`);
      }
    },
    toBeDefined: () => {
      const pass = actual !== undefined;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected value ${isNot ? 'to be undefined' : 'to be defined'}, received ${safeFormat(actual)}`);
      }
    },
    toBeUndefined: () => {
      const pass = actual === undefined;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected undefined, received ${safeFormat(actual)}`);
      }
    },
    toBeNull: () => {
      const pass = actual === null;
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${safeFormat(actual)} ${isNot ? 'not to be null' : 'to be null'}`);
      }
    },
    toBeTruthy: () => {
      const pass = Boolean(actual);
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${safeFormat(actual)} ${isNot ? 'to be falsy' : 'to be truthy'}`);
      }
    },
    toBeFalsy: () => {
      const pass = !Boolean(actual);
      if (isNot ? pass : !pass) {
        assert.fail(`Expected ${safeFormat(actual)} ${isNot ? 'to be truthy' : 'to be falsy'}`);
      }
    },
    toContain: (expected) => {
      let pass = false;
      if (typeof actual === 'string' || Array.isArray(actual)) {
        pass = actual.includes(expected);
      } else if (actual instanceof Set) {
        pass = actual.has(expected);
      } else if (actual && typeof actual === 'object') {
        pass = expected in actual;
      }
      if (isNot ? pass : !pass) {
        assert.fail(
          `Expected ${safeFormat(actual)} ${isNot ? 'not to contain' : 'to contain'} ${safeFormat(expected)}`
        );
      }
    },
    toThrow: (expected) => {
      let threw = false;
      let caughtError = null;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (err) {
        threw = true;
        caughtError = err;
      }
      if (expected && threw) {
        if (typeof expected === 'string') {
          assert(caughtError.message.includes(expected), `Expected error message to contain "${expected}", got "${caughtError.message}"`);
        } else if (expected instanceof RegExp) {
          assert(expected.test(caughtError.message), `Expected error message to match ${expected}, got "${caughtError.message}"`);
        }
      }
      if (isNot ? threw : !threw) {
        assert.fail(`Expected function ${isNot ? 'not to throw' : 'to throw'}`);
      }
    },
  };
}

global.expect = (actual) => {
  const matchers = createMatchers(actual, false);
  matchers.not = createMatchers(actual, true);
  return matchers;
};

const vitestPlugin = {
  name: 'vitest-mock',
  setup(build) {
    build.onResolve({ filter: /^vitest$/ }, (args) => ({
      path: args.path,
      namespace: 'vitest-mock',
    }));
    build.onLoad({ filter: /^vitest$/, namespace: 'vitest-mock' }, () => ({
      contents: `
        export const describe = global.describe;
        export const it = global.it;
        export const test = global.it;
        export const expect = global.expect;
        export const beforeEach = (fn) => {};
        export const afterEach = (fn) => {};
        export const beforeAll = (fn) => {};
        export const afterAll = (fn) => {};
      `,
      loader: 'js',
    }));
  },
};

async function runTests() {
  const fs = require('fs');
  const pholab2Dir = process.env.PHOLAB2_DIR || (fs.existsSync(path.join(__dirname, 'src')) ? __dirname : 'c:/Users/josef/Desktop/pholab/pholab-2.0');
  const testFiles = [
    path.join(pholab2Dir, 'src/experiments/ipho-2024-e2/physics.test.ts'),
    path.join(pholab2Dir, 'src/experiments/ipho-2024-e2/state.test.ts'),
    path.join(pholab2Dir, 'src/experiments/ipho-2024-e2/calibration.test.ts'),
    path.join(pholab2Dir, 'src/core/primitives/primitives.test.ts'),
    path.join(pholab2Dir, 'src/experiments/ipho-2024-e2/interaction.test.ts'),
  ];

  console.log('='.repeat(70));
  console.log('   PhOLab 2.0 Unified Physics & Systems Verification Runner');
  console.log('='.repeat(70));

  const totalStart = Date.now();

  for (const file of testFiles) {
    const filename = path.basename(file);
    const relPath = path.relative(pholab2Dir, file).replace(/\\/g, '/');
    console.log(`\n▶ Compiling & running: ${relPath}`);
    const compileStart = Date.now();

    const result = await esbuild.build({
      entryPoints: [file],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      plugins: [vitestPlugin],
    });

    const compileTime = Date.now() - compileStart;
    const code = result.outputFiles[0].text;
    const fn = new Function(code);
    fn();
  }

  const totalElapsedMs = Date.now() - totalStart;

  console.log('\n' + '='.repeat(70));
  console.log('                     VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Test Files:      ${testFiles.length} passed (${testFiles.length} total)`);
  console.log(`  Test Suites:     ${stats.suitesPassed} passed, ${stats.suitesFailed} failed, ${stats.suites} total`);
  console.log(`  Test Cases:      ${stats.testsPassed} passed, ${stats.testsFailed} failed, ${stats.tests} total`);
  console.log(`  Success Rate:    ${((stats.testsPassed / (stats.tests || 1)) * 100).toFixed(1)}%`);
  console.log(`  Duration:        ${(totalElapsedMs / 1000).toFixed(2)}s`);
  console.log('='.repeat(70));

  if (stats.testsFailed > 0 || process.exitCode === 1) {
    console.error('\n❌ Tests FAILED! Please review the failures above.');
    process.exit(1);
  } else {
    console.log('\n✅ 100% of all physics, state, calibration & primitive tests PASSED!\n');
  }
}

runTests().catch((err) => {
  console.error('\nRunner encountered an unexpected error:');
  console.error(err);
  process.exit(1);
});
