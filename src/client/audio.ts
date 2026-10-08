// Event-cue audio engine for Return by Midnight.
// Original procedural synthesis via WebAudio — no samples, no libraries.
// Stable event IDs; repeated identical cues within a short window are deduped
// (also protects co-op where the same world event can arrive twice).

export type RbmCue =
  | "loan.tag"
  | "loan.retract"
  | "safe.thunk"
  | "crate.shift"
  | "gate.slam"
  | "gate.lift"
  | "plate.press"
  | "guard.alert"
  | "toy.windup"
  | "manifest.commit"
  | "command.deny"
  | "plan.verify"
  | "plan.contradict"
  | "midnight.strike"
  | "ui.tick";

type Voice = {
  kind: OscillatorType | "noise";
  freq: number;
  freqEnd?: number;
  gain: number;
  attack?: number;
  decay: number;
  delay?: number;
  filter?: number;
};

const CUES: Record<RbmCue, Voice[]> = {
  "loan.tag": [
    { kind: "sine", freq: 659, gain: 0.08, decay: 0.15 },
    { kind: "sine", freq: 880, gain: 0.06, decay: 0.2, delay: 0.07 },
  ],
  "loan.retract": [
    { kind: "sine", freq: 880, freqEnd: 440, gain: 0.06, decay: 0.4 },
    { kind: "noise", freq: 0, gain: 0.04, decay: 0.3, filter: 2000 },
  ],
  "safe.thunk": [
    { kind: "sine", freq: 70, freqEnd: 45, gain: 0.22, decay: 0.35 },
    { kind: "noise", freq: 0, gain: 0.1, decay: 0.15, filter: 500 },
  ],
  "crate.shift": [
    { kind: "triangle", freq: 150, gain: 0.1, decay: 0.15 },
    { kind: "noise", freq: 0, gain: 0.06, decay: 0.2, filter: 1200 },
  ],
  "gate.slam": [
    { kind: "sine", freq: 95, freqEnd: 55, gain: 0.2, decay: 0.4 },
    { kind: "square", freq: 420, gain: 0.05, decay: 0.08 },
    { kind: "noise", freq: 0, gain: 0.09, decay: 0.25, filter: 800 },
  ],
  "gate.lift": [
    { kind: "noise", freq: 0, gain: 0.06, decay: 0.5, filter: 1400 },
    { kind: "sawtooth", freq: 110, freqEnd: 165, gain: 0.04, decay: 0.45 },
  ],
  "plate.press": [
    { kind: "sine", freq: 330, gain: 0.09, decay: 0.12 },
    { kind: "sine", freq: 165, gain: 0.07, decay: 0.2, delay: 0.06 },
  ],
  "guard.alert": [
    { kind: "square", freq: 740, gain: 0.07, decay: 0.12 },
    { kind: "square", freq: 740, gain: 0.07, decay: 0.12, delay: 0.16 },
  ],
  "toy.windup": [
    { kind: "square", freq: 880, gain: 0.06, decay: 0.05 },
    { kind: "square", freq: 990, gain: 0.06, decay: 0.05, delay: 0.07 },
    { kind: "square", freq: 1100, gain: 0.06, decay: 0.05, delay: 0.14 },
    { kind: "square", freq: 990, gain: 0.05, decay: 0.05, delay: 0.21 },
  ],
  "manifest.commit": [
    { kind: "sine", freq: 523, gain: 0.08, decay: 0.12 },
    { kind: "sine", freq: 659, gain: 0.08, decay: 0.18, delay: 0.08 },
  ],
  "command.deny": [
    { kind: "square", freq: 196, gain: 0.07, decay: 0.15 },
    { kind: "square", freq: 147, gain: 0.07, decay: 0.22, delay: 0.1 },
  ],
  "plan.verify": [
    { kind: "sine", freq: 784, gain: 0.09, decay: 0.25 },
    { kind: "sine", freq: 1046, gain: 0.07, decay: 0.35, delay: 0.12 },
  ],
  "plan.contradict": [
    { kind: "sawtooth", freq: 220, freqEnd: 185, gain: 0.07, decay: 0.4 },
    { kind: "sawtooth", freq: 233, freqEnd: 196, gain: 0.06, decay: 0.4 },
  ],
  "midnight.strike": [
    { kind: "sine", freq: 523, gain: 0.12, decay: 1.2 },
    { kind: "sine", freq: 1046, gain: 0.06, decay: 0.9 },
    { kind: "sine", freq: 392, gain: 0.1, decay: 1.4, delay: 0.35 },
    { kind: "sine", freq: 784, gain: 0.05, decay: 1.0, delay: 0.35 },
  ],
  "ui.tick": [{ kind: "sine", freq: 1046, gain: 0.05, decay: 0.06 }],
};

export class RbmAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastPlay = new Map<string, number>();

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  get isMuted() {
    return this.muted;
  }

  /** Play a cue. `eventId` dedupes identical world events (e.g. co-op replays). */
  play(cue: RbmCue, eventId?: string) {
    const key = eventId ? `${cue}#${eventId}` : cue;
    const now = performance.now();
    const last = this.lastPlay.get(key) ?? -Infinity;
    if (now - last < 120) return; // dedupe window
    this.lastPlay.set(key, now);
    if (this.lastPlay.size > 512) this.lastPlay.clear();

    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    for (const v of CUES[cue]) {
      const start = t0 + (v.delay ?? 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(v.gain, start + (v.attack ?? 0.01));
      g.gain.exponentialRampToValueAtTime(0.0008, start + v.decay);
      let node: AudioScheduledSourceNode;
      if (v.kind === "noise") {
        const len = Math.max(1, Math.floor(ctx.sampleRate * (v.decay + 0.05)));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        node = src;
      } else {
        const osc = ctx.createOscillator();
        osc.type = v.kind;
        osc.frequency.setValueAtTime(v.freq, start);
        if (v.freqEnd) osc.frequency.exponentialRampToValueAtTime(v.freqEnd, start + v.decay);
        node = osc;
      }
      if (v.filter) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = v.filter;
        node.connect(f).connect(g);
      } else {
        node.connect(g);
      }
      g.connect(this.master);
      node.start(start);
      node.stop(start + v.decay + 0.1);
    }
  }
}

export const rbmAudio = new RbmAudio();
