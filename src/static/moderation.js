/* Stride — Community Moderation
   Report and Block functionality for all community pages.
   Client-side only — no persistence yet. */

var MODERATION_BLOCKED = (function() {
  try { return JSON.parse(sessionStorage.getItem("stride-blocked") || "[]"); }
  catch(e) { return []; }
})();

function moderationActions(targetName) {
  var div = document.createElement("div");
  div.className = "mod-actions";

  // Report button
  var reportBtn = document.createElement("button");
  reportBtn.className = "mod-link";
  reportBtn.textContent = "Report";
  reportBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    showReportDialog(targetName);
  };

  // Block button
  var blockBtn = document.createElement("button");
  blockBtn.className = "mod-link";
  blockBtn.textContent = "Block";
  blockBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    showBlockDialog(targetName);
  };

  div.appendChild(reportBtn);
  div.appendChild(blockBtn);
  return div;
}

function showReportDialog(targetName) {
  var overlay = document.createElement("div");
  overlay.className = "mod-overlay";

  var dialog = document.createElement("div");
  dialog.className = "mod-dialog";

  dialog.innerHTML = '<h3 class="font-display text-lg font-bold">Report content</h3>' +
    '<p class="text-sm text-muted mt-1">Report a concern about <strong>' + escapeHTML(targetName) + '</strong>.</p>' +
    '<label class="mt-4 text-sm font-semibold" for="mod-reason">Reason</label>' +
    '<select id="mod-reason" style="margin-top:4px;">' +
    '<option value="">Select...</option>' +
    '<option value="spam">Spam</option>' +
    '<option value="harassment">Harassment</option>' +
    '<option value="inappropriate">Inappropriate content</option>' +
    '<option value="other">Other</option>' +
    '</select>' +
    '<label class="text-sm font-semibold" for="mod-details" style="margin-top:12px;display:block;">Details (optional)</label>' +
    '<textarea id="mod-details" rows="3" placeholder="Any additional context..." style="margin-top:4px;"></textarea>' +
    '<div class="mod-dialog-actions">' +
    '<button class="btn btn-secondary" id="mod-cancel" style="font-size:12px;">Cancel</button>' +
    '<button class="btn btn-primary" id="mod-submit" style="font-size:12px;">Submit report</button>' +
    '</div>';

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  dialog.querySelector("#mod-cancel").onclick = function() { document.body.removeChild(overlay); };
  overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
  dialog.querySelector("#mod-submit").onclick = function() {
    document.body.removeChild(overlay);
    showToast("Report submitted. We'll review it within 24 hours.");
  };
}

function showBlockDialog(targetName) {
  var overlay = document.createElement("div");
  overlay.className = "mod-overlay";

  var dialog = document.createElement("div");
  dialog.className = "mod-dialog";

  dialog.innerHTML = '<h3 class="font-display text-lg font-bold">Block user</h3>' +
    '<p class="text-sm text-muted mt-1">Block <strong>' + escapeHTML(targetName) + '</strong>? You won\'t see their posts anymore.</p>' +
    '<div class="mod-dialog-actions" style="margin-top:20px;">' +
    '<button class="btn btn-secondary" id="mod-cancel" style="font-size:12px;">Cancel</button>' +
    '<button class="btn btn-primary" id="mod-confirm" style="font-size:12px;background:var(--magenta);border-color:var(--magenta);">Block user</button>' +
    '</div>';

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  dialog.querySelector("#mod-cancel").onclick = function() { document.body.removeChild(overlay); };
  overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
  dialog.querySelector("#mod-confirm").onclick = function() {
    MODERATION_BLOCKED.push(targetName);
    sessionStorage.setItem("stride-blocked", JSON.stringify(MODERATION_BLOCKED));
    document.body.removeChild(overlay);
    hideBlockedContent();
    showToast(targetName + " has been blocked.");
  };
}

function hideBlockedContent() {
  var cards = document.querySelectorAll("[data-user]");
  for (var i = 0; i < cards.length; i++) {
    var user = cards[i].getAttribute("data-user");
    if (MODERATION_BLOCKED.indexOf(user) !== -1) {
      cards[i].style.display = "none";
    }
  }
}

function showToast(message) {
  var toast = document.createElement("div");
  toast.className = "mod-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3500);
}

function escapeHTML(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Run on page load
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", hideBlockedContent);
}
