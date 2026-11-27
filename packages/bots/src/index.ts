export { greedy } from "./greedy";
export { type GameRecord, playGame } from "./play";
export { type Policy, Rng, random } from "./policy";

import { ENGINE_VERSION } from "@bull-city-blocks/engine";
/** Kept for the sim placeholder until #12 replaces it. */
export const BOTS_ENGINE_VERSION: string = ENGINE_VERSION;
