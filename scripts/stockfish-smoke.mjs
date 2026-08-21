import { access, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const enginePath = path.join(projectRoot, "public", "stockfish", "stockfish-18-lite-single.js");
const wasmPath = path.join(projectRoot, "public", "stockfish", "stockfish-18-lite-single.wasm");

await Promise.all([access(enginePath), access(wasmPath)]);
const [workerStat, wasmStat] = await Promise.all([stat(enginePath), stat(wasmPath)]);
const require = createRequire(import.meta.url);
const initStockfish = require("stockfish");
const engine = await initStockfish(enginePath);

const result = await new Promise((resolve, reject) => {
  const state = { uciok: false, readyok: false, info: false, bestmove: "", depth: 0 };
  const timeout = setTimeout(() => {
    reject(new Error(`Stockfish smoke test timed out: ${JSON.stringify(state)}`));
  }, 30_000);

  engine.listener = (value) => {
    const line = String(value);
    if (line === "uciok") {
      state.uciok = true;
      engine.sendCommand("setoption name Hash value 16");
      engine.sendCommand("isready");
      return;
    }
    if (line === "readyok") {
      state.readyok = true;
      engine.sendCommand("position fen rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
      engine.sendCommand("go depth 11");
      return;
    }
    if (line.startsWith("info ")) {
      state.info = true;
      state.depth = Math.max(state.depth, Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0));
      return;
    }
    if (line.startsWith("bestmove")) {
      state.bestmove = line.match(/^bestmove\s+(\S+)/)?.[1] ?? "";
      clearTimeout(timeout);
      resolve(state);
    }
  };

  engine.sendCommand("uci");
});

if (!result.uciok || !result.readyok || !result.info || !result.bestmove) {
  throw new Error(`Stockfish handshake was incomplete: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify({
  engine: "Stockfish 18 lite single-threaded",
  workerBytes: workerStat.size,
  wasmBytes: wasmStat.size,
  ...result,
}, null, 2));
