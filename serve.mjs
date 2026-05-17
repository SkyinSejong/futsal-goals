// 로컬 미리보기용 정적 서버 (개발 편의 도구). 사이트에 배포되지 않는다.
//
// file:// 로 열면 페이지 origin 이 null 이라 유튜브 임베드가 거부되어
// "오류 153" 이 날 수 있다. http://localhost 로 열면 이 문제가 사라진다.
// GitHub Pages 는 https 라 마찬가지로 정상 동작한다.
//
// 사용법:  node serve.mjs        (기본 포트 8080)
//          node serve.mjs 3000   (포트 지정)
// 그 후 브라우저에서 http://localhost:8080 접속

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    if (rel === "/" || rel === "\\" || rel === "") rel = "index.html";
    const filePath = join(ROOT, rel);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
}).listen(PORT, () => {
  console.log(`로컬 서버 실행 중:  http://localhost:${PORT}`);
  console.log("종료하려면 Ctrl+C");
});
