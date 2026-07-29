const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const SITE_DIR = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": ext.match(/\.(jpg|jpeg|png|webp|svg|ico)$/) ? "public, max-age=86400" : "no-cache",
    });
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

  // Community routes
  if (pathname === "/community") {
    servePage(res, "community.html");
    return;
  }

  if (pathname === "/community/circles") {
    servePage(res, "community-circles.html");
    return;
  }

  if (pathname.startsWith("/community/pace/")) {
    servePage(res, "community-pace.html");
    return;
  }

  if (pathname.startsWith("/community/")) {
    servePage(res, "community-segment.html");
    return;
  }

  // Plan PDF print view
  if (pathname.startsWith("/plan/") && pathname.endsWith("/pdf")) {
    servePage(res, "plan-pdf.html");
    return;
  }

  // API: plan .ics download
  if (pathname === "/api/plan.ics") {
    res.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=stride-roadmap.ics",
    });
    res.end("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Stride//EN\r\nEND:VCALENDAR");
    return;
  }

  // Pace calculator
  if (pathname === "/pace-calculator") {
    servePage(res, "pace-calculator.html");
    return;
  }

  // Legal pages
  if (pathname === "/privacy") {
    servePage(res, "privacy.html");
    return;
  }

  if (pathname === "/terms") {
    servePage(res, "terms.html");
    return;
  }

  if (pathname === "/cookies") {
    servePage(res, "cookies.html");
    return;
  }

  if (pathname === "/data-deletion") {
    servePage(res, "data-deletion.html");
    return;
  }

  if (pathname === "/health-disclosure") {
    servePage(res, "health-disclosure.html");
    return;
  }

  if (pathname === "/accessibility") {
    servePage(res, "accessibility.html");
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
