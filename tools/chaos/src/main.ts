import { loadConfig } from './profile';
import { startChaosProxy } from './proxy';

function log(line: string): void {
  console.log(`[chaos] ${line}`);
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Chaos mode is for development only.');
}

const config = loadConfig(process.env, Date.now() >>> 0);
const proxy = await startChaosProxy(config, log);
const { latencyMs, jitterMs, lossRate } = config.profile;

log(`ws://localhost:${proxy.port}/ws -> ${config.target}`);
log(`${latencyMs} ms ±${jitterMs} ms each way, ${lossRate * 100}% loss, seed ${config.seed}`);
