import '@testing-library/jest-dom';

// Make vitest globals available
import { expect, test, describe, it, vi, beforeEach, afterEach } from 'vitest';

// Make these available globally
globalThis.expect = expect;
globalThis.test = test;
globalThis.describe = describe;
globalThis.it = it;
globalThis.vi = vi;
globalThis.beforeEach = beforeEach;
globalThis.afterEach = afterEach;

