import { BOTS_ENGINE_VERSION } from "@bull-city-blocks/bots";
import { ENGINE_VERSION } from "@bull-city-blocks/engine";

/** Placeholder until the simulator lands. Imports engine and bots to prove workspace wiring. */
export const SIM_VERSIONS = { engine: ENGINE_VERSION, bots: BOTS_ENGINE_VERSION } as const;
