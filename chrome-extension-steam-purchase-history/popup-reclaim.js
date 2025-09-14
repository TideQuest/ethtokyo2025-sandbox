// Reclaim integration for Chrome extension - Backend API version
// This file handles communication with the backend API for Reclaim proof generation

const BACKEND_API_URL = 'http://localhost:3000/api/zkp';

// Generate Steam proof via backend API
async function generateSteamProof(targetAppId) {
  try {
    // Get Steam user data from the extension
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'getUserDataUrlAndCookies'
      }, resolve);
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get Steam data');
    }

    const { steamId, url, cookieStr } = response.data;

    // Display loading state
    updateProofStatus('Generating proof via backend API...');

    // Call backend API to generate proof
    const proofResponse = await fetch(`${BACKEND_API_URL}/steam/proof`, {
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

    const result = await proofResponse.json();

    if (!proofResponse.ok) {
      throw new Error(result.error || 'Failed to generate proof');
    }

    // Display success
    updateProofStatus('Proof generated successfully!');
    displayProofResult(result);

    // Persist for content scripts to forward into the web app
    try {
      chrome.storage?.local?.set({ latestSteamProof: result });
    } catch (e) {
      console.warn('Failed to store latestSteamProof:', e);
    }

    return result;
  } catch (error) {
    console.error('Proof generation failed:', error);
    updateProofStatus(`Error: ${error.message}`, true);
    throw error;
  }
}

// Verify Steam proof via backend API
async function verifySteamProof(proof, steamId, targetAppId) {
  try {
    updateProofStatus('Verifying proof...');

    const response = await fetch(`${BACKEND_API_URL}/steam/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proof,
        steamId,
        targetAppId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to verify proof');
    }

    if (result.verified) {
      updateProofStatus('Proof verified successfully!');
    } else {
      updateProofStatus(`Proof verification failed: ${result.reason}`, true);
    }

    displayVerificationResult(result);
    return result;
  } catch (error) {
    console.error('Proof verification failed:', error);
    updateProofStatus(`Error: ${error.message}`, true);
    throw error;
  }
}

// UI helper functions
function updateProofStatus(message, isError = false) {
  const statusElement = document.getElementById('proof-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = isError ? 'error' : 'success';
  }
}

function displayProofResult(result) {
  const outputElement = document.getElementById('proof-output');
  if (outputElement) {
    outputElement.innerHTML = `
      <div class="proof-result">
        <h4>Proof Generated</h4>
        <p><strong>Mode:</strong> ${result.mode}</p>
        <p><strong>Steam ID:</strong> ${result.steamId}</p>
        ${result.targetAppId ? `<p><strong>Target App ID:</strong> ${result.targetAppId}</p>` : ''}
        <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
        ${result.proof ? `
          <details>
            <summary>Proof Details</summary>
            <pre>${JSON.stringify(result.proof, null, 2)}</pre>
          </details>
        ` : ''}
      </div>
    `;
  }
}

function displayVerificationResult(result) {
  const outputElement = document.getElementById('verification-output');
  if (outputElement) {
    outputElement.innerHTML = `
      <div class="verification-result ${result.verified ? 'verified' : 'failed'}">
        <h4>Verification Result</h4>
        <p><strong>Status:</strong> ${result.verified ? '✅ Verified' : '❌ Failed'}</p>
        <p><strong>Reason:</strong> ${result.reason}</p>
        ${result.steamId ? `<p><strong>Steam ID:</strong> ${result.steamId}</p>` : ''}
        ${result.targetAppId ? `<p><strong>Target App ID:</strong> ${result.targetAppId}</p>` : ''}
      </div>
    `;
  }
}

// Initialize Reclaim integration
document.addEventListener('DOMContentLoaded', () => {
  // Add Reclaim tab if not exists
  const tabsContainer = document.querySelector('.tabs');
  if (tabsContainer && !document.querySelector('[data-tab="reclaim"]')) {
    const reclaimTab = document.createElement('button');
    reclaimTab.className = 'tab';
    reclaimTab.setAttribute('data-tab', 'reclaim');
    reclaimTab.textContent = 'Reclaim Proof';
    tabsContainer.appendChild(reclaimTab);
  }

  // Add Reclaim content section
  const dataContainer = document.getElementById('dataContainer');
  if (dataContainer && !document.getElementById('reclaim-content')) {
    const reclaimContent = document.createElement('div');
    reclaimContent.id = 'reclaim-content';
    reclaimContent.className = 'tab-content';
    reclaimContent.style.display = 'none';
    reclaimContent.innerHTML = `
      <div class="reclaim-section">
        <h3>Generate Steam Ownership Proof</h3>
        <p>Generate a cryptographic proof of your Steam game ownership using Reclaim Protocol.</p>

        <div class="input-group">
          <label for="target-app-id">Target App ID (optional):</label>
          <input type="text" id="target-app-id" placeholder="e.g., 730 for CS:GO">
          <small>Leave empty to prove general Steam account ownership</small>
        </div>

        <button id="generate-proof-btn" class="btn btn-primary">Generate Proof</button>

        <div id="proof-status" class="status-message"></div>
        <div id="proof-output" class="output-container"></div>

        <hr>

        <h3>Verify Proof</h3>
        <div class="input-group">
          <label for="proof-input">Paste proof JSON:</label>
          <textarea id="proof-input" rows="5" placeholder="Paste the proof JSON here"></textarea>
        </div>

        <button id="verify-proof-btn" class="btn btn-secondary">Verify Proof</button>

        <div id="verification-output" class="output-container"></div>
      </div>
    `;
    dataContainer.appendChild(reclaimContent);
  }

  // Add event listeners
  const generateBtn = document.getElementById('generate-proof-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const targetAppId = document.getElementById('target-app-id').value.trim();
      try {
        await generateSteamProof(targetAppId || undefined);
      } catch (error) {
        console.error('Failed to generate proof:', error);
      }
    });
  }

  const verifyBtn = document.getElementById('verify-proof-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const proofInput = document.getElementById('proof-input').value.trim();
      if (!proofInput) {
        updateProofStatus('Please paste a proof to verify', true);
        return;
      }

      try {
        const proofData = JSON.parse(proofInput);
        await verifySteamProof(
          proofData.proof || proofData,
          proofData.steamId,
          proofData.targetAppId
        );
      } catch (error) {
        if (error instanceof SyntaxError) {
          updateProofStatus('Invalid JSON format', true);
        } else {
          console.error('Failed to verify proof:', error);
        }
      }
    });
  }

  // Handle tab switching for Reclaim tab
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName === 'reclaim') {
        // Hide all other content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.style.display = 'none';
        });
        // Show Reclaim content
        const reclaimContent = document.getElementById('reclaim-content');
        if (reclaimContent) {
          reclaimContent.style.display = 'block';
        }
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      }
    });
  });
});

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateSteamProof,
    verifySteamProof
  };
}
