const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const SITE_DIR = __dirname;

const PAGES = {
  "/": "home.html",
  "/onboarding": "onboarding.html",
  "/plan": "plan.html",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

function servePage(res, pageName) {
  serveFile(res, path.join(SITE_DIR, "src", "pages", pageName));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API routes
  if (pathname === "/api/site.json") {
    serveFile(res, path.join(SITE_DIR, "site.json"));
    return;
  }

  // Static files (CSS, JS, images)
  if (pathname.startsWith("/static/")) {
    serveFile(res, path.join(SITE_DIR, "src", pathname));
    return;
  }

  // Page routes
  if (pathname === "/") {
    servePage(res, "home.html");
    return;
  }

  if (pathname.startsWith("/onboarding/")) {
    servePage(res, "onboarding.html");
    return;
  }

  if (pathname.startsWith("/plan/")) {
    servePage(res, "plan.html");
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Stride server running on port ${PORT}`);
});
