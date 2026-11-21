const http = require("http");

const MAX_BODY = 64 * 1024;

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) reject(new RequestError("본문이 너무 커요", 413));
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size === 0) return resolve({});
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (value && typeof value === "object" && !Array.isArray(value)) return resolve(value);
      } catch {}
      reject(new RequestError("JSON 객체 본문이 아니에요"));
    });
    req.on("error", reject);
  });
}

function createJsonServer(routes, log = () => {}) {
  return http.createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    const url = new URL(req.url, "http://local");
    const route = routes[`${req.method} ${url.pathname}`];
    if (!route) return send(res, 404, { error: "없는 경로예요" });
    try {
      const body = req.method === "POST" ? await readJson(req) : {};
      send(res, 200, await route(body, url.searchParams));
    } catch (e) {
      const status = e instanceof RequestError ? e.status : 500;
      if (status === 500) log(`${req.method} ${url.pathname} failed: ${e.shortMessage || e.message}`);
      send(res, status, { error: e.shortMessage || e.message });
    }
  });
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

module.exports = { createJsonServer, RequestError };
