import { PROTOCOL_VERSION } from '@pvp/protocol';
import { loadConfig } from './config';
import { startServer } from './start-server';

const server = await startServer(loadConfig(process.env));
console.log(`Game server on port ${server.port}, protocol v${PROTOCOL_VERSION}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.stop();
    process.exit(0);
  });
}
