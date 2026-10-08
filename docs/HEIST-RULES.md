# Return by Midnight — heist turn rules (authoritative)

Engine: `src/engine/heist/` (pure, deterministic; no DOM, network, time or randomness). Types: `src/engine/heist/types.ts`.
Every rule below has a unit test in `tests/unit/heist-*.test.ts`.

## Board
- Tiles: `#` wall · `.` floor · `:` dark floor · `E` exit · `P` pressure plate · `D` door · ` ` void.
- Passable for crew and guards: floor, dark, exit, plate, and a door only while open. Never: wall, void, or a tile holding an object.
- Objects (crate, safe, lamp, toy, music box, plinth) occupy one tile each. They block movement **and** sight.
- Sight blockers: walls, closed doors, objects. (Void counts as wall.)
- Prize: a non-blocking pickup tile. The first crew member to stand on it carries it.

## Properties and loans
- A property token (`HEAVY`, `BRIGHT`, `NOISY`) is always at exactly one object: its **home** or a loan **target**. An object's properties are the tokens currently at it.
- **Loan action** (at most one per crew member per turn): legal when the token is at home, the crew member's tile at the **start of the turn** is within Chebyshev distance 1 of the home object, and the target is a different existing object. The token moves to the target with `dueTurn = turn + duration`.
- **Return**: at the start of turn `dueTurn` the token snaps home. Nobody can recall it early, and a token can't be re-lent while it's out.
- If two crew lend the same token in the same turn, the lower crew index (level order) wins and the other emits `loan.fizzled{why:"notHome"}`. A loan whose adjacency/target became invalid also fizzles. Plan validation catches these in solo play.
- **HEAVY** on an object standing on a plate presses the plate. Crew and guards don't press plates. A door is open iff at least one of its plates is pressed.
- **BRIGHT** lights every tile within Chebyshev distance 2 of the object that has line of sight to it. Lighting matters only on dark tiles.
- **NOISY**: an object holding NOISY is a sound source every turn it holds it.

## Line of sight
Tile B is in line of sight from tile A when the segment between the two tile centres passes through the **interior** of no blocker tile (A and B themselves are excluded). Grazing an edge or a corner does not block. This is computed with exact integer arithmetic (coordinates ×2).

## Vision cone
A guard at G facing f sees tile T when: forward distance d (along f) is 1..sight, lateral offset |l| ≤ d, T is in line of sight from G, and T is not an unlit dark tile. A crew member on a seen tile is **seen**. A crew member who shares a tile with a guard, or swaps tiles with one during a step, is also seen ("bumped").

## Guard intent (the telegraph)
Intent is computed once per turn, **after** returns and new loans (step 0), and is fixed for the rest of the turn. The planning UI shows it computed from the known scheduled returns plus the local player's planned loans.
1. **Noise check**: the sources are objects holding NOISY within Manhattan distance ≤ hearing. Pick the nearest by Manhattan distance (ties: level object order). If one exists → mode `investigate`: walk the BFS shortest path (passability at step 0; ties broken N, E, S, W) toward the nearest passable tile orthogonally adjacent to the source, up to `speed` steps. Each move faces the direction of travel. Once stopped, the guard faces the source (|dx| ≥ |dy| → E/W, else N/S). If the source is unreachable the guard only turns. If it has heard the source this turn, it emits `guard.heard` at step 0, and step 0's facing already points at the source.
2. Otherwise, if mode was `investigate` or `return` and the guard isn't on `route[routeIndex]` → mode `return`: BFS toward that tile, up to `speed` steps. Reaching it switches the mode to `patrol`, and the remaining steps of that turn stand still.
3. Otherwise → `patrol`: advance `speed` entries along the route loop. Moving faces the direction of travel. A repeated entry stands still, facing its `face` if set.
4. Steps after the guard's speed is spent are "stand still, keep facing".

## Turn resolution (turn t)
1. **Returns** — tokens with `dueTurn == t` go home (`loan.returned`).
2. **New loans** — in crew order (`loan.made` / `loan.fizzled`).
3. **Doors** — recompute every door. A door that closes on a crew member's tile → that crew member is **shut in** (fail `shutIn`). A door doesn't close while a guard stands in it (it stays open).
4. **Guard intents** — see above. Emit step 0 (state after 1–4). **Vision check.**
5. **Movement** — steps k = 1, 2, 3. Within a step everyone moves at once:
   - Guards take `poses[k]`. If a crew member is on that tile, or is swapping with the guard, that crew member is seen.
   - Crew: target = `path[k-1]` if present, otherwise stay. A target is blocked when it's impassable now, or when another crew member stays on it or moves to it. If two crew target the same tile, the lower index goes and the other is blocked. Two crew swapping tiles are both blocked. Resolve to a fixpoint. A blocked crew member stays put and drops the rest of their path (`crew.blocked`).
   - Stepping onto the prize tile picks the prize up (`prize.taken`).
   - **Vision check** after the step. If anyone is seen, the heist ends: outcome `failed/seen` at (t, k), and the timeline is truncated there.
6. **End of turn** — **won** when every crew member stands on an exit tile, the prize (if the level has one) is carried, and every token is home. Otherwise, if `t == midnight` → `failed/loanNotHome` (with `tokenIds`) if any token is out, else `failed/midnight`. Otherwise `turn = t + 1`.

## Plan validation (UI + server)
`path` length ≤ 3. Each tile is orthogonally adjacent to the previous one (or to the crew's tile). No tile is static-impassable (wall/void/object). A door is allowed (its state may change). An optional loan must be legal at the start of the turn, given the scheduled returns.
