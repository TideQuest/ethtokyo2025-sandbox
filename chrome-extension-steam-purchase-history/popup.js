// Backend API configuration
const BACKEND_API_URL = 'http://localhost:3000/api/zkp';

document.addEventListener("DOMContentLoaded", function () {
  const statusEl = document.getElementById("status");
  const dataContainer = document.getElementById("dataContainer");
  const tabs = document.querySelectorAll(".tab");
  const genProofBtn = document.getElementById("genProofBtn");
  const appSelect = document.getElementById("appSelect");
  const proofStatus = document.getElementById("proofStatus");
  const proofOutput = document.getElementById("proofOutput");
  // Ethereum UI removed

  let currentTab = "overview";
  let userData = null;

  function updateStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.backgroundColor = isError ? "#ffebee" : "#f0f8ff";
    statusEl.style.borderColor = isError ? "#e74c3c" : "#4a90e2";
    statusEl.style.color = isError ? "#e74c3c" : "#333";
  }

  function showLoading() {
    updateStatus("Fetching Steam data...");
    dataContainer.innerHTML = '<div class="loading">Loading Steam user data...</div>';
  }

  function hideLoading() {
    // No-op: buttons removed; keep for symmetry
  }

  // Ethereum status removed

  function setProofStatus(message, isError = false) {
    proofStatus.style.display = "block";
    proofStatus.textContent = message;
    proofStatus.style.backgroundColor = isError ? "#ffebee" : "#f0f8ff";
    proofStatus.style.borderColor = isError ? "#e74c3c" : "#4a90e2";
    proofStatus.style.color = isError ? "#e74c3c" : "#333";
  }

  function showProofOutput(obj) {
    proofOutput.style.display = "block";
    proofOutput.textContent =
      typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function displayOverview() {
    if (!userData) {
      dataContainer.innerHTML = '<div class="no-data">No data available</div>';
      return;
    }

    const fetchTime = new Date(userData.fetchTime).toLocaleString();

    dataContainer.innerHTML = `
      <div class="data-item">
        <strong>Steam ID:</strong> ${userData.steamId}
      </div>
      <div class="data-item">
        <strong>Country:</strong> ${userData.countryCode}
      </div>
      <div class="data-item">
        <strong>Account Balance:</strong> ${userData.accountBalance}
      </div>
      <div class="summary">
        <span>Games: ${userData.ownedGames.length}</span>
      </div>
      ${
        userData.hardwareUsed && userData.hardwareUsed.length > 0
          ? `
        <div class="data-item">
          <strong>Hardware Used:</strong> ${userData.hardwareUsed.join(", ")}
        </div>
      `
          : ""
      }
      
      <div class="data-item">
        <strong>Data Source:</strong> ${userData.sourceUrl}
      </div>
      <div class="timestamp">
        Last fetched: ${fetchTime}
      </div>
    `;
  }

  function displayGames() {
    if (!userData || !userData.ownedGames.length) {
      dataContainer.innerHTML =
        '<div class="no-data">No owned games found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Owned Games (${userData.ownedGames.length})</strong></div>`;

    userData.ownedGames.slice(0, 50).forEach((game) => {
      const playtime = game.playtime
        ? `${Math.round(game.playtime / 60)} hours`
        : "Unknown playtime";
      const gameName =
        game.name && game.name !== `App ${game.appId}`
          ? game.name
          : `App ${game.appId}`;
      const developers =
        game.developers && game.developers.length > 0
          ? ` (${game.developers.join(", ")})`
          : "";
      const type = game.type ? ` [${game.type}]` : "";
      const genres =
        game.genres && game.genres.length > 0
          ? ` | ${game.genres.map((g) => g.description).join(", ")}`
          : "";

      html += `
        <div class="game-item">
          <div><strong>${gameName}${developers}</strong>${type}</div>
          <div>App ID: ${game.appId} | Playtime: ${playtime}${genres}</div>
          ${
            game.source
              ? `<div style="font-size: 10px; color: #888;">Source: ${game.source}</div>`
              : ""
          }
        </div>
      `;
    });

    if (userData.ownedGames.length > 50) {
      html += `<div class="no-data">... and ${
        userData.ownedGames.length - 50
      } more games</div>`;
    }

    dataContainer.innerHTML = html;
  }

  // Wishlist and Tags views removed

  function displayCurrentTab() {
    switch (currentTab) {
      case "overview":
        displayOverview();
        break;
      case "games":
        displayGames();
        break;
      
    }
  }

  function loadExistingData() {
    chrome.runtime.sendMessage({ action: "getSteamUserData" }, (response) => {
      if (response) {
        userData = response;
        updateStatus("Data loaded from cache");
        populateOwnedGamesSelector();
        displayCurrentTab();
      }
    });
  }

  function fetchSteamData() {
    showLoading();

    chrome.runtime.sendMessage({ action: "fetchSteamUserData" }, (response) => {
      hideLoading();

      if (response.success) {
        userData = response.data;
        updateStatus("Steam data fetched successfully!");
        populateOwnedGamesSelector();
        displayCurrentTab();
      } else {
        updateStatus(`Error: ${response.error}`, true);
        dataContainer.innerHTML = `<div class="error">${response.error}</div>`;
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      displayCurrentTab();
    });
  });

  function sendMessageAsync(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(resp);
      });
    });
  }

  // Ethereum-related handlers removed

  function populateOwnedGamesSelector() {
    if (!appSelect) return;
    appSelect.innerHTML = "";
    if (!userData || !userData.ownedGames || userData.ownedGames.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = "No owned games available";
      appSelect.appendChild(opt);
      return;
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "Select a game";
    appSelect.appendChild(placeholder);

    const sorted = [...userData.ownedGames].sort((a, b) => {
      const an = (a.name || `App ${a.appId}`).toLowerCase();
      const bn = (b.name || `App ${b.appId}`).toLowerCase();
      return an.localeCompare(bn);
    });
    for (const game of sorted) {
      const option = document.createElement("option");
      option.value = game.appId;
      const gameName = game.name && game.name !== `App ${game.appId}` ? game.name : `App ${game.appId}`;
      option.textContent = `${gameName} (${game.appId})`;
      appSelect.appendChild(option);
    }
  }

  genProofBtn.addEventListener("click", async () => {
    proofOutput.style.display = 'none';
    setProofStatus("Preparing proof request...");

    const targetAppId = (appSelect?.value || '').trim();
    if (!targetAppId) {
      setProofStatus("Please select a game from Owned Games", true);
      return;
    }

    // Ask background for the current user's URL and cookies
    chrome.runtime.sendMessage({ action: 'getUserDataUrlAndCookies' }, async (resp) => {
      if (!resp || !resp.success) {
        setProofStatus(`Failed to prepare: ${resp?.error || 'unknown error'}`, true);
        return;
      }

      const { url, steamId, cookieStr } = resp.data;

      try {
        setProofStatus("Generating proof via backend API...");

        // Call backend API to generate proof
        const response = await fetch(`${BACKEND_API_URL}/steam/proof`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            steamId,
            userDataUrl: url,
            cookieStr,
            targetAppId
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setProofStatus(`Failed: ${result.error || 'Unknown error'}`, true);
          showProofOutput({ error: result.error || 'Failed to generate proof' });
          return;
        }

        setProofStatus("Proof generated successfully!");
        showProofOutput(result);
      } catch (err) {
        setProofStatus(`Error: ${err?.message || String(err)}`, true);
        showProofOutput({ error: err?.message || String(err) });
      }
    });
  });

  // Load any cached data for quick display, then auto-fetch fresh data
  loadExistingData();
  fetchSteamData();
});
