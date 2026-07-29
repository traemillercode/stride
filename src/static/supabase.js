// Client-side Supabase module — uses CDN-hosted Supabase client
// This file is loaded via <script> tag in HTML pages
(function() {
  'use strict';

  // Will be initialized once the CDN script loads
  var _client = null;
  var _initialized = false;

  function init() {
    if (_initialized) return;
    if (typeof window.supabase === 'undefined') {
      console.warn('Supabase CDN not loaded yet');
      return;
    }
    _client = window.supabase.createClient(
      'https://fgitsanuwzelslkzihtn.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnaXRzYW51d3plbHNsa3ppaHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNzYzMTMsImV4cCI6MjEwMDg1MjMxM30.4lYCx5LpX5JhXV2KqJ4YBX2D2q9kV7N5h9z1q8R2V0E'
    );
    _initialized = true;
  }

  // Retry init until supabase CDN is loaded
  function waitForInit(cb) {
    if (_initialized && _client) return cb(_client);
    init();
    if (_initialized && _client) return cb(_client);
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      init();
      if (_client) {
        clearInterval(timer);
        cb(_client);
      } else if (attempts > 50) {
        clearInterval(timer);
        cb(null);
      }
    }, 100);
  }

  window.StrideAuth = {
    getClient: function(cb) {
      waitForInit(cb);
    },

    signUp: function(email, password, displayName, cb) {
      waitForInit(function(client) {
        if (!client) return cb(new Error('Auth service unavailable'));
        client.auth.signUp({
          email: email,
          password: password,
          options: { data: { display_name: displayName } }
        }).then(function(r) {
          cb(r.error, r.data);
        }).catch(cb);
      });
    },

    signIn: function(email, password, cb) {
      waitForInit(function(client) {
        if (!client) return cb(new Error('Auth service unavailable'));
        client.auth.signInWithPassword({
          email: email,
          password: password
        }).then(function(r) {
          cb(r.error, r.data);
        }).catch(cb);
      });
    },

    signOut: function(cb) {
      waitForInit(function(client) {
        if (!client) return cb(new Error('Auth service unavailable'));
        client.auth.signOut().then(function(r) {
          cb(r.error);
        }).catch(cb);
      });
    },

    getCurrentUser: function(cb) {
      waitForInit(function(client) {
        if (!client) return cb(new Error('Auth service unavailable'));
        client.auth.getUser().then(function(r) {
          cb(r.error, r.data ? r.data.user : null);
        }).catch(cb);
      });
    },

    getSession: function(cb) {
      waitForInit(function(client) {
        if (!client) return cb(new Error('Auth service unavailable'));
        client.auth.getSession().then(function(r) {
          cb(r.error, r.data ? r.data.session : null);
        }).catch(cb);
      });
    },

    onAuthStateChange: function(cb) {
      waitForInit(function(client) {
        if (!client) return;
        client.auth.onAuthStateChange(function(event, session) {
          cb(event, session);
        });
      });
    }
  };
})();
