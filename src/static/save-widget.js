// Save Widget — shared client-side module for pin/save functionality
// Include this after supabase CDN + /static/supabase.js
// Renders auth-aware nav and handles save button clicks on any page
(function() {
  'use strict';

  var currentUser = null;
  var userBoards = [];

  // ── Init: check auth state ──
  function init() {
    // Render auth nav
    var navArea = document.getElementById('nav-auth-area');
    if (!navArea) return; // Page doesn't have auth nav

    StrideAuth.getCurrentUser(function(err, user) {
      if (err || !user) {
        currentUser = null;
        renderNavSignedOut(navArea);
      } else {
        currentUser = user;
        renderNavSignedIn(navArea, user);
      }
    });
  }

  function renderNavSignedOut(navArea) {
    navArea.innerHTML = '<a href="/auth/signin" class="nav-link" style="font-weight:600;color:var(--cobalt);">Sign in</a>';
  }

  function renderNavSignedIn(navArea, user) {
    var displayName = (user.user_metadata && user.user_metadata.display_name) || user.email || 'Runner';
    var initials = getInitials(displayName);
    navArea.innerHTML =
      '<div class="user-nav" style="display:flex;align-items:center;gap:12px;">' +
        '<div class="user-nav-avatar" style="width:32px;height:32px;border-radius:50%;background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--text-muted);">' + initials + '</div>' +
        '<a href="/profile" class="user-nav-name" style="font-size:13px;font-weight:600;color:var(--charcoal);">' + displayName + '</a>' +
        '<a href="/boards" class="user-nav-name" style="font-size:13px;font-weight:600;color:var(--charcoal);">My boards</a>' +
        '<button class="sign-out-btn" style="font-size:12px;color:var(--text-muted);cursor:pointer;background:none;border:none;font-family:inherit;padding:0;" onclick="StrideAuth.signOut(function(){window.location.reload()})">Sign out</button>' +
      '</div>';
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().substring(0, 2);
  }

  // ── Save button handler ──
  function handleSaveClick(btn) {
    var itemType = btn.getAttribute('data-item-type');
    var itemId = btn.getAttribute('data-item-id');
    var itemTitle = btn.getAttribute('data-item-title');
    var itemUrl = btn.getAttribute('data-item-url');
    var itemDescription = btn.getAttribute('data-item-description') || '';

    if (!currentUser) {
      // Not signed in
      showSavePrompt(btn, 'signin');
      return;
    }

    // Fetch boards and show dropdown
    loadBoards(function(boards) {
      if (!boards || !boards.length) {
        // No boards — prompt to create one
        showSavePrompt(btn, 'no-boards');
        return;
      }
      showBoardDropdown(btn, boards, itemType, itemId, itemTitle, itemUrl, itemDescription);
    });
  }

  function loadBoards(cb) {
    if (userBoards.length > 0) {
      cb(userBoards);
      return;
    }

    StrideAuth.getSession(function(err, session) {
      if (err || !session) { cb([]); return; }

      fetch('/api/boards', {
        headers: { 'Authorization': 'Bearer ' + session.access_token }
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          userBoards = data.boards || data || [];
          cb(userBoards);
        })
        .catch(function() { cb([]); });
    });
  }

  function showSavePrompt(btn, reason) {
    // Remove any existing dropdown
    removeDropdown();

    var wrapper = document.createElement('div');
    wrapper.className = 'save-dropdown';
    wrapper.style.cssText = 'position:absolute;z-index:1000;background:#fff;border:1px solid var(--border-visible);border-radius:var(--radius);padding:16px;min-width:220px;box-shadow:0 4px 16px rgba(0,0,0,0.1);margin-top:4px;';

    if (reason === 'signin') {
      wrapper.innerHTML =
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Sign in to save items to your boards.</p>' +
        '<a href="/auth/signin" class="btn btn-primary" style="display:block;text-align:center;font-size:12px;padding:8px 16px;">Sign in</a>';
    } else {
      wrapper.innerHTML =
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Create a board first to start saving.</p>' +
        '<a href="/boards" class="btn btn-primary" style="display:block;text-align:center;font-size:12px;padding:8px 16px;">Go to my boards</a>';
    }

    positionAndAttach(btn, wrapper);
  }

  function showBoardDropdown(btn, boards, itemType, itemId, itemTitle, itemUrl, itemDescription) {
    removeDropdown();

    var wrapper = document.createElement('div');
    wrapper.className = 'save-dropdown';
    wrapper.style.cssText = 'position:absolute;z-index:1000;background:#fff;border:1px solid var(--border-visible);border-radius:var(--radius);padding:8px 0;min-width:220px;box-shadow:0 4px 16px rgba(0,0,0,0.1);margin-top:4px;max-height:280px;overflow-y:auto;';

    var html = '<div style="padding:6px 14px;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;">Save to board</div>';

    boards.forEach(function(board) {
      html += '<div class="save-board-option" data-board-id="' + board.id + '" style="padding:8px 14px;cursor:pointer;font-size:13px;color:var(--charcoal);display:flex;align-items:center;justify-content:space-between;transition:background 0.12s;">' +
        '<span>' + escHtml(board.name) + '</span>' +
        (board.is_public ? '<span style="font-size:10px;color:var(--text-dim);">public</span>' : '<span style="font-size:10px;color:var(--text-dim);">private</span>') +
        '</div>';
    });

    wrapper.innerHTML = html;

    // Hover effects via event delegation
    wrapper.addEventListener('mouseover', function(e) {
      var opt = e.target.closest('.save-board-option');
      if (opt) opt.style.background = 'var(--surface-2)';
    });
    wrapper.addEventListener('mouseout', function(e) {
      var opt = e.target.closest('.save-board-option');
      if (opt) opt.style.background = '';
    });

    // Click to pin
    wrapper.addEventListener('click', function(e) {
      var opt = e.target.closest('.save-board-option');
      if (!opt) return;
      var boardId = opt.getAttribute('data-board-id');
      savePin(btn, boardId, itemType, itemId, itemTitle, itemUrl, itemDescription);
      removeDropdown();
    });

    positionAndAttach(btn, wrapper);
  }

  function savePin(btn, boardId, itemType, itemId, itemTitle, itemUrl, itemDescription) {
    StrideAuth.getSession(function(err, session) {
      if (err || !session) {
        showToast('Sign in to save', true);
        return;
      }

      fetch('/api/boards/' + boardId + '/pins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          item_title: itemTitle,
          item_url: itemUrl,
          item_description: itemDescription
        })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) {
            showToast(data.error, true);
          } else {
            showToast('Saved', false);
          }
        })
        .catch(function() {
          showToast('Could not save. Try again.', true);
        });
    });
  }

  function showToast(msg, isError) {
    var existing = document.getElementById('save-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'save-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:' + (isError ? 'var(--magenta)' : 'var(--cobalt)') + ';color:#fff;padding:10px 24px;border-radius:var(--radius);font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    }, 2000);
  }

  function positionAndAttach(btn, wrapper) {
    var parent = btn.parentNode;
    if (!parent) return;
    // Make parent position relative if not already
    var parentPos = window.getComputedStyle(parent).position;
    if (parentPos === 'static') parent.style.position = 'relative';
    parent.appendChild(wrapper);
  }

  function removeDropdown() {
    var existing = document.querySelector('.save-dropdown');
    if (existing) existing.remove();
  }

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Close dropdown on outside click ──
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.save-btn') && !e.target.closest('.save-dropdown')) {
      removeDropdown();
    }
  });

  // ── Attach save button listeners (event delegation) ──
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.save-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    handleSaveClick(btn);
  });

  // ── Run init on load ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();