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

async function runAdversarialTests() {
  const file = path.join(pholabDir, 'src/experiments/ipho-2024-e2/challenger2-stress.test.ts');
  console.log('='.repeat(70));
  console.log('   Challenger 2 Controls, Interlocks & Workload Empirical Stress Runner');
  console.log('='.repeat(70));

  const totalStart = Date.now();
  const result = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [vitestPlugin],
  });

  const code = result.outputFiles[0].text;
  const fn = new Function(code);
  fn();

  const totalElapsedMs = Date.now() - totalStart;

  console.log('\n' + '='.repeat(70));
  console.log('             CHALLENGER 2 STRESS VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Test Suites:     ${stats.suitesPassed} passed, ${stats.suitesFailed} failed, ${stats.suites} total`);
  console.log(`  Test Cases:      ${stats.testsPassed} passed, ${stats.testsFailed} failed, ${stats.tests} total`);
  console.log(`  Success Rate:    ${((stats.testsPassed / (stats.tests || 1)) * 100).toFixed(1)}%`);
  console.log(`  Duration:        ${(totalElapsedMs / 1000).toFixed(2)}s`);
  console.log('='.repeat(70));

  if (stats.testsFailed > 0 || process.exitCode === 1) {
    console.error('\n❌ Challenger 2 Stress Tests FAILED!');
    process.exit(1);
  } else {
    console.log('\n✅ 100% of Challenger 2 Adversarial Stress Tests PASSED!\n');
  }
}

runAdversarialTests().catch((err) => {
  console.error('\nRunner encountered an unexpected error:');
  console.error(err);
  process.exit(1);
});
