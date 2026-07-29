// Stride news pipeline — fetches running news from public RSS feeds
// Zero dependencies — uses only Node.js standard library
// Run: node src/news-pipeline.js
// Output: src/static/news-feed.json (top 5 most recent articles)

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Feed definitions ──────────────────────────────────────────────
const FEEDS = [
  {
    url: "https://www.irunfar.com/feed",
    sourceName: "iRunFar",
    defaultCategory: "trail",
  },
  {
    url: "https://athleticsweekly.com/feed/",
    sourceName: "Athletics Weekly",
    defaultCategory: "track",
  },
  {
    url: "https://runningmagazine.ca/feed/",
    sourceName: "Running Magazine",
    defaultCategory: "road",
  },
];

// ── Category mapping: try to infer from feed categories ──────────
const CATEGORY_KEYWORDS = {
  trail: ["trail", "ultra", "ultrarunning", "fkt", "fastest known time", "mountain"],
  track: ["track", "track & field", "track and field", "athletics", "100m", "200m", "400m", "800m", "1500m", "5000m", "10000m", "steeplechase", "decathlon", "heptathlon", "pole vault", "long jump", "high jump", "shot put", "javelin", "discus", "relay", "meetings", "reports"],
  road: ["road", "marathon", "half marathon", "half-marathon", "10k", "5k", "road running", "road race"],
  gear: ["gear", "shoe", "review", "trainer", "apparel", "watch", "gps"],
  records: ["record", "world record", "national record", "championship record", "wr"],
};

function classifyArticle(title, desc, feedCategories, defaultCat) {
  // Check feed-level categories first
  var text = (title + " " + desc + " " + (feedCategories || []).join(" ")).toLowerCase();
  for (var cat in CATEGORY_KEYWORDS) {
    var keywords = CATEGORY_KEYWORDS[cat];
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) !== -1) {
        return cat;
      }
    }
  }
  return defaultCat;
}

// ── RSS XML Parser (regex-based, no xml2js dependency) ───────────
function parseRSS(xml, sourceName, defaultCategory) {
  var items = [];
  // Extract <item>...</item> blocks
  var itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  var match;
  while ((match = itemRegex.exec(xml)) !== null) {
    var block = match[1];
    var item = {};

    // Title
    var titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(block);
    if (titleMatch) {
      item.title = decodeHTMLEntities(cleanCDATA(titleMatch[1])).trim();
    }

    // Link
    var linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(block);
    if (linkMatch) {
      item.link = cleanCDATA(linkMatch[1]).trim();
    }

    // PubDate
    var pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block);
    if (pubDateMatch) {
      item.pubDate = cleanCDATA(pubDateMatch[1]).trim();
    }

    // Description
    var descMatch = /<description>([\s\S]*?)<\/description>/i.exec(block);
    if (descMatch) {
      item.description = cleanCDATA(descMatch[1]).trim();
    }

    // Categories (all <category> tags)
    var catRegex = /<category(?:[^>]*?)>([\s\S]*?)<\/category>/gi;
    var categories = [];
    var catMatch;
    while ((catMatch = catRegex.exec(block)) !== null) {
      var cat = cleanCDATA(catMatch[1]).trim();
      if (cat) categories.push(cat);
    }

    if (item.title && item.link) {
      item.source = sourceName;
      item.sourceName = sourceName; // dup for template compatibility
      item.categories = categories;
      item.category = classifyArticle(item.title, item.description || "", categories, defaultCategory);
      // Clean up description: strip HTML, truncate
      item.summary = cleanSummary(item.description || "", item.title);
      // Parse date for sorting
      item.dateRaw = item.pubDate || "";
      try {
        item.date = new Date(item.pubDate).toISOString().split("T")[0];
      } catch (e) {
        item.date = "";
      }
      items.push(item);
    }
  }
  return items;
}

function cleanCDATA(str) {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanSummary(html, title) {
  // Strip all HTML tags
  var text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Remove common RSS boilerplate
  text = text.replace(/The post .+? appeared first on .+?\./gi, "");
  text = text.replace(/\[…\]/g, "…");
  // Remove "by Author" attribution at end
  text = text.replace(/\s+by\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*\.?\s*$/g, "");
  // Remove leading/trailing whitespace and collapsed spaces
  text = text.replace(/\s+/g, " ").trim();
  // If the summary is very short or empty, take first 2 sentences from the cleaned text
  if (text.length < 20) {
    // Try content:encoded or just return what we have
    var sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length >= 1) {
      text = sentences.slice(0, 2).join(" ").trim();
    }
  } else if (text.length > 280) {
    text = text.substring(0, 277) + "…";
  }
  // Ensure we don't use the title as the summary
  if (text.length < 20 || text === title) {
    return "";
  }
  return text;
}

// ── HTTP fetch helper ────────────────────────────────────────────
function fetchURL(url) {
  return new Promise(function (resolve, reject) {
    var options = {
      timeout: 10000,
      headers: {
        "User-Agent": "StrideNewsBot/1.0 (news aggregator; https://stride.ctonew.app)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    };
    var req = https.get(url, options, function (res) {
      // Follow 301/302 redirects (one level)
      if (res.statusCode === 301 || res.statusCode === 302) {
        var loc = res.headers.location;
        if (loc) {
          https.get(loc, options, function (r2) {
            var data = "";
            r2.on("data", function (chunk) { data += chunk; });
            r2.on("end", function () { resolve(data); });
          }).on("error", reject).on("timeout", function () { this.destroy(); reject(new Error("timeout")); });
          return;
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode));
        return;
      }
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () { resolve(data); });
    });
    req.on("error", reject);
    req.on("timeout", function () {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("Stride News Pipeline — fetching running news…\n");

  var allArticles = [];

  for (var i = 0; i < FEEDS.length; i++) {
    var feed = FEEDS[i];
    console.log("  Fetching " + feed.sourceName + " (" + feed.url + ")…");
    try {
      var xml = await fetchURL(feed.url);
      var articles = parseRSS(xml, feed.sourceName, feed.defaultCategory);
      console.log("    ✓ " + articles.length + " articles parsed");
      allArticles = allArticles.concat(articles);
    } catch (err) {
      console.log("    ✗ Failed: " + err.message + " — skipping");
    }
  }

  // Sort by date (newest first), fallback to end of array for items without dates
  allArticles.sort(function (a, b) {
    var da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    var db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  // Take top 5
  var top5 = allArticles.slice(0, 5);

  // Strip internal fields before output
  top5 = top5.map(function (a) {
    return {
      title: a.title,
      source: a.source,
      sourceName: a.sourceName,
      category: a.category,
      date: a.date,
      link: a.link,
      summary: a.summary,
    };
  });

  console.log("\n  Total articles across all feeds: " + allArticles.length);
  console.log("  Top 5 selected for output.\n");

  // Write output
  var outPath = path.join(__dirname, "static", "news-feed.json");
  var outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outPath, JSON.stringify(top5, null, 2), "utf-8");
  console.log("  ✓ Written to src/static/news-feed.json");

  // Print summary
  console.log("\n── Top 5 Articles ──");
  top5.forEach(function (a, idx) {
    console.log("  " + (idx + 1) + ". [" + a.category + "] " + a.title);
    console.log("     via " + a.source + " | " + a.date);
    console.log("     " + (a.summary || "(no summary)").substring(0, 100) + "…");
  });
}

main().catch(function (err) {
  console.error("Pipeline failed:", err.message);
  process.exit(1);
});
