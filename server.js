const http = require("http");
const fs = require("fs");
const path = require("path");

// Server-side database helpers (Supabase client)
let db = null;
try {
  db = require("./src/db.js");
} catch (e) {
  console.warn("[stride] db module not available — running without database:", e.message);
}

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

  // ── Auth: Sign up ──
  // POST /api/auth/signup
  if (pathname === "/api/auth/signup" && req.method === "POST") {
    if (!db) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Database not available" }));
      return;
    }
    db.parseBody(req).then(function(body) {
      var email = body.email;
      var password = body.password;
      var displayName = body.displayName;

      if (!email || !password || !displayName) {
        db.json(res, 400, { error: "Email, password, and display name are required." });
        return;
      }

      var supabase = db.getClient();

      // Create user in Supabase Auth
      supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { display_name: displayName }
      }).then(function(r) {
        if (r.error) {
          if (r.error.message && r.error.message.includes("already")) {
            db.json(res, 409, { error: "An account with this email already exists." });
          } else {
            db.json(res, 400, { error: r.error.message });
          }
          return;
        }

        var userId = r.data.user.id;

        // Insert into public.users table (if table exists)
        supabase.from("users").upsert({
          id: userId,
          email: email,
          display_name: displayName,
          created_at: new Date().toISOString()
        }).then(function(insertResult) {
          // Table might not exist yet — that's OK, profile API falls back to auth data
          db.json(res, 201, {
            user: {
              id: userId,
              email: email,
              display_name: displayName
            }
          });
        }).catch(function() {
          // Table doesn't exist — still return success (auth user created)
          db.json(res, 201, {
            user: {
              id: userId,
              email: email,
              display_name: displayName
            },
            note: "Run migration.sql in Supabase SQL Editor to enable full profile features."
          });
        });
      }).catch(function(err) {
        db.json(res, 500, { error: err.message });
      });
    }).catch(function() {
      db.json(res, 400, { error: "Invalid JSON body" });
    });
    return;
  }

  // ── Auth: Sign in ──
  // POST /api/auth/signin
  if (pathname === "/api/auth/signin" && req.method === "POST") {
    if (!db) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Database not available" }));
      return;
    }
    db.parseBody(req).then(function(body) {
      var email = body.email;
      var password = body.password;

      if (!email || !password) {
        db.json(res, 400, { error: "Email and password are required." });
        return;
      }

      var supabase = db.getClient();
      supabase.auth.signInWithPassword({
        email: email,
        password: password
      }).then(function(r) {
        if (r.error) {
          db.json(res, 401, { error: r.error.message });
          return;
        }
        db.json(res, 200, {
          user: r.data.user,
          session: r.data.session
        });
      }).catch(function(err) {
        db.json(res, 500, { error: err.message });
      });
    }).catch(function() {
      db.json(res, 400, { error: "Invalid JSON body" });
    });
    return;
  }

  // ── Profile: Get user profile ──
  // GET /api/profile?userId=UUID
  if (pathname === "/api/profile" && req.method === "GET") {
    if (!db) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Database not available" }));
      return;
    }

    var userId = url.searchParams.get("userId");
    if (!userId) {
      db.json(res, 400, { error: "userId query parameter is required." });
      return;
    }

    var supabase = db.getClient();

    // Try to get user from public.users table
    supabase.from("users").select("*").eq("id", userId).single()
      .then(function(userResult) {
        var user = userResult.data;
        var userError = userResult.error;

        // If table doesn't exist, fall back to auth
        if (userError || !user) {
          // Try getting from auth
          return supabase.auth.admin.getUserById(userId).then(function(authResult) {
            var authUser = authResult.data ? authResult.data.user : null;
            if (!authUser) {
              db.json(res, 404, { error: "User not found." });
              return;
            }
            db.json(res, 200, {
              user: {
                id: authUser.id,
                email: authUser.email,
                display_name: (authUser.user_metadata && authUser.user_metadata.display_name) || authUser.email,
                created_at: authUser.created_at
              },
              activities: [],
              stats: { followers: 0, following: 0, totalMiles: 0, avgPace: null, activityCount: 0 }
            });
          });
        }

        // Got user — now get activities and follow counts
        return Promise.all([
          Promise.resolve(user),
          supabase.from("activities").select("*").eq("user_id", userId).order("posted_at", { ascending: false }).limit(20),
          supabase.from("follows").select("id", { count: "exact" }).eq("following_id", userId),
          supabase.from("follows").select("id", { count: "exact" }).eq("follower_id", userId)
        ]).then(function(results) {
          var u = results[0];
          var activitiesResult = results[1];
          var followersResult = results[2];
          var followingResult = results[3];

          var activities = activitiesResult.data || [];
          var followers = (followersResult && followersResult.count) || 0;
          var following = (followingResult && followingResult.count) || 0;

          // Compute stats
          var totalMiles = 0;
          var totalPaceTime = 0;
          var paceCount = 0;
          activities.forEach(function(a) {
            if (a.distance_mi) totalMiles += parseFloat(a.distance_mi);
            if (a.avg_pace_secs) { totalPaceTime += a.avg_pace_secs; paceCount++; }
          });
          var avgPace = paceCount > 0 ? Math.round(totalPaceTime / paceCount) : null;

          db.json(res, 200, {
            user: u,
            activities: activities,
            stats: {
              followers: followers,
              following: following,
              totalMiles: Math.round(totalMiles * 10) / 10,
              avgPace: avgPace,
              activityCount: activities.length
            }
          });
        });
      }).catch(function(err) {
        db.json(res, 500, { error: err.message });
      });
    return;
  }

  // ── Profile: Follow/unfollow ──
  // POST /api/profile/follow
  if (pathname === "/api/profile/follow" && req.method === "POST") {
    if (!db) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Database not available" }));
      return;
    }
    db.parseBody(req).then(function(body) {
      var followerId = body.followerId;
      var followingId = body.followingId;
      var action = body.action; // "follow" or "unfollow"

      if (!followerId || !followingId || !action) {
        db.json(res, 400, { error: "followerId, followingId, and action are required." });
        return;
      }

      var supabase = db.getClient();

      if (action === "follow") {
        supabase.from("follows").upsert({
          follower_id: followerId,
          following_id: followingId
        }).then(function(r) {
          if (r.error) {
            db.json(res, 400, { error: r.error.message });
            return;
          }
          db.json(res, 200, { status: "following" });
        }).catch(function(err) {
          db.json(res, 500, { error: err.message });
        });
      } else if (action === "unfollow") {
        supabase.from("follows").delete()
          .eq("follower_id", followerId)
          .eq("following_id", followingId)
          .then(function(r) {
            if (r.error) {
              db.json(res, 400, { error: r.error.message });
              return;
            }
            db.json(res, 200, { status: "unfollowed" });
          }).catch(function(err) {
            db.json(res, 500, { error: err.message });
          });
      } else {
        db.json(res, 400, { error: "action must be 'follow' or 'unfollow'" });
      }
    }).catch(function() {
      db.json(res, 400, { error: "Invalid JSON body" });
    });
    return;
  }

  // GET /api/news — returns the news feed JSON
  if (pathname === "/api/news") {
    try {
      var newsPath = path.join(SITE_DIR, "src", "static", "news-feed.json");
      if (fs.existsSync(newsPath)) {
        serveFile(res, newsPath);
      } else {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
        res.end("[]");
      }
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
      res.end("[]");
    }
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

    if (pathname === "/community-guidelines") {
      servePage(res, "community-guidelines.html");
      return;
    }

    if (pathname === "/payment-refund") {
      servePage(res, "payment-refund.html");
      return;
    }

    if (pathname === "/verified-business-terms") {
      servePage(res, "verified-business-terms.html");
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

  // Auth pages
  if (pathname === "/auth/signup") {
    servePage(res, "auth-signup.html");
    return;
  }

  if (pathname === "/auth/signin") {
    servePage(res, "auth-signin.html");
    return;
  }

  // Profile page
  if (pathname === "/profile") {
    servePage(res, "profile.html");
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
