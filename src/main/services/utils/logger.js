const DEBUG = process.env.DEBUG === '1';

const logger = {
  info:  (msg, ...args) => console.log(`[INFO]  ${msg}`, ...args),
  warn:  (msg, ...args) => console.warn(`[WARN]  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg, ...args) => { if (DEBUG) console.log(`[DEBUG] ${msg}`, ...args); },
};

module.exports = logger;
