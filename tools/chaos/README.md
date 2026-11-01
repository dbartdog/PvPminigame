# Network chaos mode

A dev-only WebSocket proxy that adds latency, jitter and packet loss between client and server.

```bash
pnpm dev     # client and server
pnpm chaos   # proxy on ws://localhost:3002/ws, forwarding to ws://localhost:3001/ws
```

| Variable             | Default                  | Meaning                                       |
| -------------------- | ------------------------ | --------------------------------------------- |
| `CHAOS_PORT`         | `3002`                   | Port the proxy listens on                     |
| `CHAOS_TARGET`       | `ws://localhost:3001/ws` | Game server to forward to                     |
| `CHAOS_LATENCY_MS`   | `100`                    | Delay added to each frame, in each direction  |
| `CHAOS_JITTER_MS`    | `20`                     | How far each delay can vary, either side      |
| `CHAOS_LOSS_PERCENT` | `2`                      | Chance a droppable frame is lost              |
| `CHAOS_SEED`         | current time             | Set it to repeat the same run of random picks |

## How it models a bad network

WebSocket runs on TCP, so a real lost packet is resent and shows up as a delay, never as a missing frame. True packet loss can't be reproduced at this layer, so the proxy follows these rules:

- **Latency is per direction.** The defaults add about 200 ms to the round trip.
- **Frames never reorder.** A frame is held back until the one ahead of it has been released, because TCP guarantees order.
- **Only `Input`, `Snapshot`, `Ping` and `Pong` can be dropped.** These are the messages the game has to cope without.
- **`Hello`, `Welcome`, `JoinRoom`, `RoomState`, `Error` and non-protocol frames are never dropped.** TCP wouldn't lose them, and the game has no way to recover if they vanish.
- **Closes are delayed like frames**, so a message sent just before a close still arrives first.

The stall TCP causes while it resends a lost packet isn't modelled. Each lost frame is simply gone.
