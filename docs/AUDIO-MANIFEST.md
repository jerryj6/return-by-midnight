# Return by Midnight — audio manifest

Procedural WebAudio cues (`src/client/audio.ts`, singleton `rbmAudio`). No external files; every cue is synthesized. Stable event IDs dedupe network replays within 120 ms. Master mute via `setMuted` (Sound on/off toggle in play header).

| Cue ID | Trigger |
|---|---|
| loan.tag | manifest.row.commit (a property loan is borrowed) |
| loan.retract | manifest.row.retract |
| command.deny | action.rejected |
| ui.tick | command.queued, misc actions |
| plan.verify | test.run completed with success=true |
| plan.contradict | test.run completed with success=false |
| midnight.strike | result.accepted |
| safe.thunk | (reserved: safe/heavy interactions) |
| crate.shift | (reserved: crate movement) |
| gate.slam | (reserved: gate close) |
| gate.lift | (reserved: gate open) |
| plate.press | (reserved: pressure plate) |
| guard.alert | (reserved: guard wake) |
| toy.windup | (reserved: wind-up toy) |
| manifest.commit | manifest.commit accepted |
| result.accept | result accepted by steward |
