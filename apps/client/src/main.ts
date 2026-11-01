import { PROTOCOL_VERSION } from '@pvp/protocol';
import { TICK_RATE_HZ } from '@pvp/sim';

const app = document.querySelector('#app');
if (app) {
  app.textContent = `Client placeholder: protocol v${PROTOCOL_VERSION}, ${TICK_RATE_HZ} Hz`;
}
