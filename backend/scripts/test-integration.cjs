const fs = require('node:fs');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');

// A local .env is explicit test configuration; CI supplies environment variables.
const local = fs.existsSync('.env') ? parseEnv(fs.readFileSync('.env', 'utf8')) : {};
const result = spawnSync(process.execPath, ['node_modules/jest/bin/jest.js', '--runInBand', '--config', 'jest.integration.config.cjs'], {
  stdio: 'inherit', env: { ...process.env, ...local },
});
process.exit(result.status ?? 1);
