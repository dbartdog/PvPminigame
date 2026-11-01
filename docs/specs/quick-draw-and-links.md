# Spec: Quick Draw and challenge links (Nov 9 to Nov 15)

Goal: the first real 1v1 game, played from a shared link by two guests on different networks. Milestone gate **"First duel by link" on Nov 13**.

## Quick Draw rules

- Both players see a tense "Wait..." screen with their opponent's name and avatar.
- After a random delay of 2 to 6 seconds (chosen by the server's seeded RNG), the server sends **DRAW**.
- Each player clicks their target. The first **valid** click wins the round.
- A click before DRAW is a **foul** and loses the round immediately.
- First to 5 rounds wins the match. Show a score bar the whole time.
- If both foul in the same round, replay the round.

## Fair timing

- Before each round, the server measures each player's round-trip time (median of 5 pings).
- The client timestamps the click relative to when *it* received DRAW and sends that reaction time to the server.
- The server accepts a reported reaction time only if it is consistent with the arrival time and measured RTT (reject anything faster than 100 ms or inconsistent by more than RTT/2 + 30 ms; treat rejected clicks as not valid).
- The server decides the winner; the client only shows it.

## Challenge-link flow

1. Player A opens the site, types a name, clicks **Challenge a friend**, picks Quick Draw.
2. A sees a room screen with a big **Copy link** button (`/r/<code>`).
3. Player B opens the link, types a name (prefilled if a guest token exists), and lands in the room.
4. Both press **Ready**; a 3-second countdown starts the match.
5. Results screen: winner, score, each player's average reaction time, **Rematch** button.

## Feel

- Big readable type, a sharp sound and a screen flash on DRAW, a satisfying sound on win.
- Original placeholder art only (simple shapes, original colors); log any asset in `assets/LICENSES.csv`.

## Acceptance criteria

- [ ] Two guests on different networks (for example home Wi-Fi and a phone hotspot) complete a first-to-5 match from a shared link
- [ ] Click-to-in-match time under 15 seconds for the joining player
- [ ] Fouls, double fouls and disconnects are handled (disconnect = forfeit after 15 seconds)
- [ ] Rematch starts a new match in the same room with one click from each player
- [ ] With chaos mode on, results stay fair: a player with 100 ms extra latency is not at a measurable disadvantage in a 50-round bot test
- [ ] Sim rules for Quick Draw live in `games/quick-draw/` and are covered by tests in the shared sim style
