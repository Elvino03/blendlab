const { createServer } = require("node:http");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const port = Number(process.env.BLENDLAB_PORT || 4173);
createServer((req, res) => {
  if (/^\/(?:index\.html)?(?:\?.*)?$/.test(req.url)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(readFileSync(join(__dirname, "dist", "index.html")));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(port, "127.0.0.1", () => console.log(`Blendlab: http://127.0.0.1:${port}`));
