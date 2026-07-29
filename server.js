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

  // ── Webhook endpoint: receive activity data from connected devices ──
  // POST /api/webhook/activity
  // Accepts JSON payload with activity data from Garmin, Strava, Coros, Apple Health, Amazfit, Suunto.
  //
  // Expected payload:
  // {
  //   "user": "string (required) — user identifier (future: auth token instead)",
  //   "activity": {
  //     "type": "run | ride | swim | walk | workout",
  //     "distanceMi": 0.0,
  //     "durationSecs": 0,
  //     "avgPaceSecsPerMi": 0,
  //     "elevationFt": 0,
  //     "calories": 0
  //   },
  //   "source": {
  //     "platform": "garmin | strava | coros | apple_health | amazfit | suunto",
  //     "activityId": "platform-native activity id"
  //   },
  //   "location": { "city": "string", "state": "string" },
  //   "narrative": "string (optional) — user's note or auto-generated summary",
  //   "startedAt": "ISO 8601 datetime string"
  // }
  //
  // Auth (future): Bearer token in Authorization header, validated against user's device connections.
  // Rate limiting (future): 100 requests/hour per user, enforced via token bucket.
  //
  if (pathname === "/api/webhook/activity") {
    if (req.method === "GET") {
      // Return API documentation
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        endpoint: "/api/webhook/activity",
        method: "POST",
        description: "Receive activity data from connected devices",
        auth: "Bearer token (future)",
        rateLimit: "100 requests/hour per user (future)",
        schema: {
          required: ["user", "activity", "source"],
          properties: {
            user: { type: "string", description: "User identifier" },
            activity: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["run", "ride", "swim", "walk", "workout"] },
                distanceMi: { type: "number" },
                durationSecs: { type: "number" },
                avgPaceSecsPerMi: { type: "number" },
                elevationFt: { type: "number" },
                calories: { type: "number" }
              }
            },
            source: {
              type: "object",
              required: ["platform"],
              properties: {
                platform: { type: "string", enum: ["garmin", "strava", "coros", "apple_health", "amazfit", "suunto"] },
                activityId: { type: "string" }
              }
            },
            location: {
              type: "object",
              properties: {
                city: { type: "string" },
                state: { type: "string" }
              }
            },
            narrative: { type: "string" },
            startedAt: { type: "string", format: "date-time" }
          }
        }
      }, null, 2));
      return;
    }

    if (req.method === "POST") {
      var body = "";
      req.on("data", function(chunk) { body += chunk; });
      req.on("end", function() {
        try {
          var data = JSON.parse(body);

          // Validate required fields
          if (!data.user || typeof data.user !== "string") {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Missing or invalid field: user (string required)" }));
            return;
          }
          if (!data.activity || typeof data.activity !== "object") {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Missing or invalid field: activity (object required)" }));
            return;
          }
          if (!data.source || typeof data.source !== "object" || !data.source.platform) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Missing or invalid field: source.platform (string required)" }));
            return;
          }

          // Validate platform against known list
          var validPlatforms = ["garmin", "strava", "coros", "apple_health", "amazfit", "suunto", "manual"];
          if (validPlatforms.indexOf(data.source.platform) === -1) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Invalid platform: " + data.source.platform + ". Must be one of: " + validPlatforms.join(", ") }));
            return;
          }

          // Log received activity (console for now — future: persist to database)
          console.log("[webhook] activity received:", JSON.stringify({
            user: data.user,
            type: data.activity.type,
            platform: data.source.platform,
            timestamp: new Date().toISOString(),
          }));

          // 202 Accepted — acknowledged but not yet processed
          res.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            status: "accepted",
            message: "Activity received. Auto-post processing will begin shortly."
          }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Method not allowed
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8", "Allow": "GET, POST" });
    res.end(JSON.stringify({ error: "Method not allowed. Use GET for docs, POST to submit activity." }));
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

  // Resource pages
  if (pathname === "/resources/nutrition") {
    servePage(res, "nutrition.html");
    return;
  }

  if (pathname === "/resources/gear") {
    servePage(res, "gear.html");
    return;
  }

  if (pathname === "/resources/playlist") {
    servePage(res, "playlist.html");
    return;
  }

  if (pathname === "/resources/form-guide") {
    servePage(res, "form-guide.html");
    return;
  }

  if (pathname === "/resources/music") {
    servePage(res, "music.html");
    return;
  }

  // Content pages
  if (pathname === "/races") {
    servePage(res, "races.html");
    return;
  }

  if (pathname === "/news") {
    servePage(res, "news.html");
    return;
  }

  // Legal & support pages
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

    if (pathname === "/dmca") {
      servePage(res, "dmca.html");
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

    if (pathname === "/contact") {
      servePage(res, "contact.html");
      return;
    }

  // Settings
  if (pathname === "/settings/auto-post") {
    servePage(res, "auto-post-settings.html");
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

  // 404 — custom error page
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  try {
    const notFoundContent = fs.readFileSync(path.join(SITE_DIR, "src", "pages", "404.html"));
    res.end(notFoundContent);
  } catch {
    res.end("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Page not found — Stride</title></head><body><h1>Page not found</h1><p><a href=\"/\">Back to Stride</a></p></body></html>");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Stride server running on port ${PORT}`);
});
