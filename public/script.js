let currentSession = null;

// Load stats on page load
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  setInterval(loadStats, 10000); // Update every 10 seconds

  // Add event listeners for buttons
  const launchBtn = document.getElementById("launchBtn");
  const openBrowserBtn = document.getElementById("openBrowserBtn");
  const terminateSessionBtn = document.getElementById("terminateSessionBtn");

  if (launchBtn) {
    launchBtn.addEventListener("click", launchBrowser);
  }

  if (openBrowserBtn) {
    openBrowserBtn.addEventListener("click", openBrowser);
  }

  if (terminateSessionBtn) {
    terminateSessionBtn.addEventListener("click", terminateSession);
  }

  // Auto-refresh stats when window gains focus
  window.addEventListener("focus", loadStats);
});

async function loadStats() {
  try {
    const response = await fetch("/api/sessions/stats");
    const stats = await response.json();

    document.getElementById("activeSessions").textContent =
      stats.activeSessions;
    document.getElementById("availablePorts").textContent =
      stats.availablePorts;
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

async function launchBrowser() {
  const launchBtn = document.getElementById("launchBtn");
  const loading = document.getElementById("loading");
  const sessionInfo = document.getElementById("sessionInfo");
  const errorDiv = document.getElementById("error");

  // Reset UI
  sessionInfo.classList.remove("show");
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

    // Store session info
    currentSession = data;

    // Update UI
    document.getElementById("sessionId").textContent = data.sessionId;
    document.getElementById("sessionUrl").textContent = data.url;
    sessionInfo.classList.add("show");

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

function openBrowser() {
  if (currentSession && currentSession.url) {
    window.open(currentSession.url, "_blank");
  }
}

async function terminateSession() {
  if (!currentSession) return;

  try {
    const response = await fetch(`/api/session/${currentSession.sessionId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      // Reset UI
      document.getElementById("sessionInfo").classList.remove("show");
      currentSession = null;

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
