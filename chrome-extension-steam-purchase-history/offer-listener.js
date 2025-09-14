// Content script for the Offer Game Recommendation page
// It listens for a button click and asks the background to open Steam

(function () {
  const isTarget = (el) => !!el && (el.matches?.('[data-open-steam-extension]') || el.id === 'open-steam-extension');

  const handleClick = (e) => {
    const btn = e.target && (e.target.closest?.('[data-open-steam-extension]') || (e.target.id === 'open-steam-extension' ? e.target : null));
    if (!btn) return;

    const steamUrl = btn.getAttribute('data-steam-url') || 'https://store.steampowered.com/';
    chrome.runtime.sendMessage({ action: 'openSteamAndExtension', steamUrl });
  };

  document.addEventListener('click', handleClick, { capture: true });

  // Bridge: when popup stores a new proof, forward it into the page
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.latestSteamProof && changes.latestSteamProof.newValue) {
        const payload = changes.latestSteamProof.newValue;
        window.postMessage({ type: 'STEAM_PROOF_FROM_EXTENSION', data: payload }, '*');
      }
    });
  } catch (e) {
    // no-op if storage not available in this context
  }
})();
