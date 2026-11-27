// Worker thread: runs one batch of games and posts the summaries back.
import { parentPort, workerData } from "node:worker_threads";
import { runBatch } from "../src/run.ts";

parentPort.postMessage(runBatch(workerData));
