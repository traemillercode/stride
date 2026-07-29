// Server-side Supabase client wrapper
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let _client = null;

function getClient() {
  if (_client) return _client;

  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach(function(l) {
    const i = l.indexOf('=');
    if (i > 0 && l[0] !== '#') env[l.substring(0, i).trim()] = l.substring(i + 1).trim();
  });

  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

// Helper: parse JSON body from request
function parseBody(req) {
  return new Promise(function(resolve, reject) {
    let body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper: send JSON response
function json(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

module.exports = { getClient, parseBody, json };
