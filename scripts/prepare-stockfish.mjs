import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const stockfishRoot = path.join(projectRoot, "node_modules", "stockfish");
const publicDirectory = path.join(projectRoot, "public", "stockfish");

const assets = [
  [path.join(stockfishRoot, "bin", "stockfish-18-lite-single.js"), "stockfish-18-lite-single.js"],
  [path.join(stockfishRoot, "bin", "stockfish-18-lite-single.wasm"), "stockfish-18-lite-single.wasm"],
  [path.join(stockfishRoot, "Copying.txt"), "Copying.txt"],
];

await mkdir(publicDirectory, { recursive: true });

for (const [source, fileName] of assets) {
  await copyFile(source, path.join(publicDirectory, fileName));
}

console.log("BoardSignal Stockfish 18 lite single-threaded assets are ready.");
