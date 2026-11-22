const fs = require("node:fs");
const path = require("node:path");
const solc = require("solc");

const root = __dirname;
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const compilerInput = {
  language: "Solidity",
  sources: { "contracts/Blendlab.sol": { content: read("contracts/Blendlab.sol") } },
  settings: {
    evmVersion: "paris",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};
const compiled = JSON.parse(solc.compile(JSON.stringify(compilerInput), {
  import: (name) => {
    try {
      return { contents: fs.readFileSync(require.resolve(name), "utf8") };
    } catch (error) {
      return { error: error.message };
    }
  }
}));
for (const error of compiled.errors ?? []) {
  if (error.severity === "error") throw Error(error.formattedMessage);
  console.warn(error.formattedMessage);
}
const contract = compiled.contracts["contracts/Blendlab.sol"].Blendlab;
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const bytecode = contract.evm.bytecode.object;
let font = "";
if (fs.existsSync(path.join(root, "assets/inter.woff2"))) {
  const data = fs.readFileSync(path.join(root, "assets/inter.woff2")).toString("base64");
  font = `/* ${read("assets/Inter-OFL.txt")} */\n@font-face { font-family: Inter; font-weight: 100 900; font-style: normal; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2"); }`;
}
const script = [`const CONTRACT_CODE = "${bytecode}";`, read("blender.js"), read("studio.js")].join("\n");
const page = read("studio.html")
  .replace("/* STUDIO_CSS */", () => read("studio.css").replace("/* STUDIO_FONT */", () => font))
  .replace("/* STUDIO_JS */", () => `"use strict";\n${script.replace(/<\/script/gi, "<\\/script")}`);
fs.writeFileSync(path.join(root, "dist/index.html"), page);
if (process.env.BLENDLAB_ARTIFACT_PATH) {
  fs.writeFileSync(process.env.BLENDLAB_ARTIFACT_PATH, JSON.stringify({ abi: contract.abi, bytecode: `0x${bytecode}` }));
}
console.log(`Built Blendlab (${bytecode.length / 2} bytes of contract initcode).`);
