import type { CrewLook, Prop } from "../../engine/heist/types";

export const C = {
  ink: 0x141a26,
  ink2: 0x202735,
  cream: 0xf3e8ce,
  teal: 0x467e78,
  gold: 0xc99a43,
  rust: 0xc16a52,
  danger: 0xe0563f,
  light: 0xffe2a0,
};

export const PROP_COLOR: Record<Prop, number> = { HEAVY: 0x6682a3, BRIGHT: 0xe8c86a, NOISY: 0xa780b7 };
export const PROP_CSS: Record<Prop, string> = { HEAVY: "#6682A3", BRIGHT: "#E8C86A", NOISY: "#A780B7" };

export const CREW_COLOR: Record<CrewLook, number> = { blue: 0x5b8fd6, red: 0xd9604c, teal: 0x47b3a3, yellow: 0xe6b440 };
export const CREW_CSS: Record<CrewLook, string> = { blue: "#5B8FD6", red: "#D9604C", teal: "#47B3A3", yellow: "#E6B440" };

/** Seat colours for co-op pings and ownership rings. */
export const SEAT_COLOR = [0xf3e8ce, 0x7fd1c4, 0xf0a35e, 0xc3a6e0];
export const SEAT_CSS = ["#F3E8CE", "#7FD1C4", "#F0A35E", "#C3A6E0"];
