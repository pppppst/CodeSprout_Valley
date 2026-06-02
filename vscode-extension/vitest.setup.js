"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
    vitest_1.vi.spyOn(console, 'info').mockImplementation(() => { });
    vitest_1.vi.spyOn(console, 'warn').mockImplementation(() => { });
    vitest_1.vi.spyOn(console, 'error').mockImplementation(() => { });
    vitest_1.vi.spyOn(console, 'debug').mockImplementation(() => { });
});
(0, vitest_1.afterEach)(() => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    vitest_1.vi.restoreAllMocks();
});
