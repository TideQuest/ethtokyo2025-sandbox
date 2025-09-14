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
})();

