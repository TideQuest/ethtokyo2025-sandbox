// Backend API configuration
const BACKEND_API_URL = 'http://localhost:3000/api/zkp';

document.addEventListener("DOMContentLoaded", function () {
  const statusEl = document.getElementById("status");
  const dataContainer = document.getElementById("dataContainer");
  const fetchBtn = document.getElementById("fetchBtn");
  const clearBtn = document.getElementById("clearBtn");
  const tabs = document.querySelectorAll(".tab");
  const genProofBtn = document.getElementById("genProofBtn");
  const appIdInput = document.getElementById("appIdInput");
  const proofStatus = document.getElementById("proofStatus");
  const proofOutput = document.getElementById("proofOutput");
  const ethStatus = document.getElementById("ethStatus");
  const checkEthBtn = document.getElementById("checkEthBtn");

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
    fetchBtn.disabled = true;
    fetchBtn.textContent = "Fetching...";
    dataContainer.innerHTML =
      '<div class="loading">Loading Steam user data...</div>';
  }

  function hideLoading() {
    fetchBtn.disabled = false;
    fetchBtn.textContent = "Fetch Steam User Data";
  }

  function setEthStatus(message, isError = false) {
    ethStatus.textContent = message;
    ethStatus.style.backgroundColor = isError ? "#ffebee" : "#f9f9f9";
    ethStatus.style.borderColor = isError ? "#e74c3c" : "#ddd";
    ethStatus.style.color = isError ? "#e74c3c" : "#333";
  }

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
        <span>Wishlist: ${userData.wishlist.length}</span>
        <span>Tags: ${
          userData.recommendedTags ? userData.recommendedTags.length : 0
        }</span>
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
      ${
        userData.recommendedTags && userData.recommendedTags.length > 0
          ? `
        <div class="data-item">
          <strong>Top Tags:</strong> ${userData.recommendedTags
            .slice(0, 5)
            .map((tag) => tag.name)
            .join(", ")}
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

  function displayWishlist() {
    if (!userData || !userData.wishlist.length) {
      dataContainer.innerHTML =
        '<div class="no-data">No wishlist items found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Wishlist (${userData.wishlist.length})</strong></div>`;

    userData.wishlist.slice(0, 30).forEach((item) => {
      const itemName =
        item.name && item.name !== `App ${item.appId}`
          ? item.name
          : `App ${item.appId}`;
      const type = item.type ? ` [${item.type}]` : "";

      html += `
        <div class="game-item">
          <div><strong>${itemName}</strong>${type}</div>
          <div>App ID: ${item.appId} | Priority: ${item.priority}</div>
          ${
            item.source
              ? `<div style="font-size: 10px; color: #888;">Source: ${item.source}</div>`
              : ""
          }
        </div>
      `;
    });

    if (userData.wishlist.length > 30) {
      html += `<div class="no-data">... and ${
        userData.wishlist.length - 30
      } more items</div>`;
    }

    dataContainer.innerHTML = html;
  }

  function displayTags() {
    if (
      !userData ||
      !userData.recommendedTags ||
      userData.recommendedTags.length === 0
    ) {
      dataContainer.innerHTML =
        '<div class="no-data">No recommended tags found</div>';
      return;
    }

    let html = `<div style="margin-bottom: 10px;"><strong>Recommended Tags (${userData.recommendedTags.length})</strong></div>`;

    userData.recommendedTags.forEach((tag) => {
      html += `
        <div class="game-item">
          <div><strong>${tag.name}</strong></div>
          <div>Tag ID: ${tag.tagId}</div>
        </div>
      `;
    });

    dataContainer.innerHTML = html;
  }

  function displayCurrentTab() {
    switch (currentTab) {
      case "overview":
        displayOverview();
        break;
      case "games":
        displayGames();
        break;
      case "wishlist":
        displayWishlist();
        break;
      case "tags":
        displayTags();
        break;
    }
  }

  function loadExistingData() {
    chrome.runtime.sendMessage({ action: "getSteamUserData" }, (response) => {
      if (response) {
        userData = response;
        updateStatus("Data loaded from cache");
        displayCurrentTab();
      }
    });

    // Load saved target app ID
    chrome.storage.local.get(["zk_appid_target"], (res) => {
      if (res.zk_appid_target) appIdInput.value = res.zk_appid_target;
    });

    // Load last captured Ethereum address
    chrome.storage.local.get(["ethAccount"], (res) => {
      const addr = res?.ethAccount?.address;
      if (addr) setEthStatus(`Connected (last seen): ${addr}`);
    });
  }

  function fetchSteamData() {
    showLoading();

    chrome.runtime.sendMessage({ action: "fetchSteamUserData" }, (response) => {
      hideLoading();

      if (response.success) {
        userData = response.data;
        updateStatus("Steam data fetched successfully!");
        displayCurrentTab();
      } else {
        updateStatus(`Error: ${response.error}`, true);
        dataContainer.innerHTML = `<div class="error">${response.error}</div>`;
      }
    });
  }

  function clearData() {
    chrome.runtime.sendMessage({ action: "clearData" }, (response) => {
      if (response.success) {
        userData = null;
        updateStatus("Data cleared");
        dataContainer.innerHTML =
          '<div class="no-data">Click "Fetch Steam User Data" to get started</div>';
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

  fetchBtn.addEventListener("click", fetchSteamData);
  clearBtn.addEventListener("click", clearData);

  function sendMessageAsync(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        resolve(resp);
      });
    });
  }

  async function checkEthAddress() {
    setEthStatus("Checking connected address...");
    try {
      const resp = await sendMessageAsync({ action: "getEthereumAddress" });
      if (!resp || !resp.success) {
        setEthStatus(`Failed: ${resp?.error || "unknown error"}`, true);
        return;
      }
      const { connected, account, error } = resp.data || {};
      if (connected && account) {
        setEthStatus(`Connected: ${account}`);
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const origin = tab?.url || '';
          await chrome.storage.local.set({ ethAccount: { address: account, origin, ts: Date.now() } });
        } catch (_) {
          // ignore storage errors
        }
      } else if (error) {
        setEthStatus(`Not connected (${error})`, true);
      } else {
        setEthStatus("No connected wallet on this page");
      }
    } catch (e) {
      setEthStatus(`Error: ${e?.message || String(e)}`, true);
    }
  }

  checkEthBtn?.addEventListener("click", checkEthAddress);

  genProofBtn.addEventListener("click", async () => {
    proofOutput.style.display = 'none';
    setProofStatus("Preparing proof request...");

    const targetAppId = (appIdInput.value || '').trim();

    // Optional: Store target app ID for convenience
    if (targetAppId) {
      chrome.storage.local.set({ zk_appid_target: targetAppId });
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
            targetAppId: targetAppId || undefined
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

  loadExistingData();
});
