let activeSessions = new Map(); // Store multiple sessions

// Load stats on page load
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadExistingSessions(); // Load any existing sessions from backend
  setInterval(loadStats, 10000); // Update every 10 seconds

  // Add event listeners for buttons
  const launchBtn = document.getElementById("launchBtn");

  if (launchBtn) {
    launchBtn.addEventListener("click", launchBrowser);
  }

  // Auto-refresh stats when window gains focus
  window.addEventListener("focus", () => {
    loadStats();
    loadExistingSessions();
  });
});

async function loadExistingSessions() {
  try {
    const response = await fetch("/api/sessions");
    const data = await response.json();

    // Clear current sessions and reload from backend
    activeSessions.clear();

    // Restore sessions from backend
    if (data.sessions && data.sessions.length > 0) {
      data.sessions.forEach(session => {
        activeSessions.set(session.sessionId, session);
      });

      // Update UI
      updateSessionsList();
      document.getElementById("sessionsContainer").classList.add("show");
    } else {
      // No sessions, hide container
      document.getElementById("sessionsContainer").classList.remove("show");
    }
  } catch (error) {
    console.error("Error loading existing sessions:", error);
  }
}

async function loadStats() {
  try {
    const response = await fetch("/api/sessions/stats");
    const stats = await response.json();

    document.getElementById("activeSessions").textContent =
      stats.activeSessions;
    document.getElementById("availablePorts").textContent =
      stats.availablePorts;

    // Show/hide sessions container based on actual backend stats
    const sessionsContainer = document.getElementById("sessionsContainer");
    if (stats.activeSessions === 0) {
      sessionsContainer.classList.remove("show");
      activeSessions.clear(); // Clear frontend state if backend has no sessions
    } else if (stats.activeSessions > 0 && activeSessions.size === 0) {
      // Backend has sessions but frontend doesn't - reload them
      loadExistingSessions();
    }
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

async function launchBrowser() {
  const launchBtn = document.getElementById("launchBtn");
  const loading = document.getElementById("loading");
  const sessionsContainer = document.getElementById("sessionsContainer");
  const errorDiv = document.getElementById("error");

  // Reset error
  errorDiv.classList.remove("show");

  // Show loading
  launchBtn.disabled = true;
  loading.style.display = "block";

  try {
    const response = await fetch("/api/session/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create session");
    }

    // Add session to our list
    activeSessions.set(data.sessionId, data);

    // Update UI
    updateSessionsList();
    sessionsContainer.classList.add("show");

    // Update stats
    loadStats();
  } catch (error) {
    console.error("Error launching browser:", error);
    errorDiv.textContent = error.message;
    errorDiv.classList.add("show");
  } finally {
    // Hide loading
    loading.style.display = "none";
    launchBtn.disabled = false;
  }
}

function updateSessionsList() {
  const sessionsList = document.getElementById("sessionsList");
  sessionsList.innerHTML = "";

  activeSessions.forEach((session, sessionId) => {
    const sessionItem = document.createElement("div");
    sessionItem.className = "session-item";
    sessionItem.innerHTML = `
      <div class="session-header">
        <strong>🌐 Browser Session</strong>
        <span class="session-id">${sessionId.substring(0, 8)}...</span>
      </div>
      <div class="session-url">${session.url || "URL not available"}</div>
      <div class="session-actions">
        <button class="btn btn-primary" data-session-id="${sessionId}" data-action="open">
          🌐 Open Browser
        </button>
        <button class="btn btn-danger" data-session-id="${sessionId}" data-action="terminate">
          🗑️ Terminate
        </button>
      </div>
    `;

    // Add event listeners for the buttons
    const openBtn = sessionItem.querySelector('[data-action="open"]');
    const terminateBtn = sessionItem.querySelector('[data-action="terminate"]');

    openBtn.addEventListener("click", () => openBrowser(sessionId));
    terminateBtn.addEventListener("click", () => terminateSession(sessionId));

    sessionsList.appendChild(sessionItem);
  });
}

function openBrowser(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session && session.url) {
    window.open(session.url, "_blank");
  }
}

async function terminateSession(sessionId) {
  try {
    const response = await fetch(`/api/session/${sessionId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      // Remove session from our list
      activeSessions.delete(sessionId);

      // Update UI
      updateSessionsList();

      // Hide container if no sessions left
      if (activeSessions.size === 0) {
        document.getElementById("sessionsContainer").classList.remove("show");
      }

      // Update stats
      loadStats();
    } else {
      throw new Error("Failed to terminate session");
    }
  } catch (error) {
    console.error("Error terminating session:", error);
    const errorDiv = document.getElementById("error");
    errorDiv.textContent = "Failed to terminate session: " + error.message;
    errorDiv.classList.add("show");
  }
}
