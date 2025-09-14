console.log('Steam Purchase History Monitor - Content Script Loaded');

function monitorSteamPurchases() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);

        addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList && (
                node.classList.contains('purchase_game') ||
                node.classList.contains('cart_item') ||
                node.classList.contains('checkout')
              )) {

              console.log('Purchase-related element detected:', node);

              chrome.runtime.sendMessage({
                action: 'purchaseElementDetected',
                data: {
                  element: node.outerHTML.substring(0, 500),
                  timestamp: new Date().toISOString(),
                  url: window.location.href
                }
              });
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  const purchaseButtons = document.querySelectorAll(
    'input[value*="purchase" i], input[value*="buy" i], button[class*="purchase"], button[class*="buy"]'
  );

  purchaseButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      console.log('Purchase button clicked:', event.target);

      chrome.runtime.sendMessage({
        action: 'purchaseButtonClicked',
        data: {
          buttonText: event.target.value || event.target.textContent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      });
    });
  });
}

function detectSteamPageType() {
  const url = window.location.href;
  const path = window.location.pathname;

  if (path.includes('/app/')) {
    console.log('Steam store page detected');
    return 'store_page';
  } else if (path.includes('/cart/')) {
    console.log('Steam cart page detected');
    return 'cart_page';
  } else if (path.includes('/checkout/')) {
    console.log('Steam checkout page detected');
    return 'checkout_page';
  } else if (path.includes('/account/') && path.includes('licenses')) {
    console.log('Steam licenses page detected');
    return 'licenses_page';
  } else if (path.includes('/account/') && path.includes('history')) {
    console.log('Steam purchase history page detected');
    return 'purchase_history_page';
  } else if (url.includes('steamcommunity.com') && path.includes('/profiles/')) {
    console.log('Steam profile page detected');
    return 'profile_page';
  }

  return 'other';
}

function monitorOwnedGames() {
  const gameElements = document.querySelectorAll(
    '.gameListRow, .game_purchase_action, .owned_game, .license_row, .game_area_purchase_game_wrapper'
  );

  gameElements.forEach((element) => {
    const gameTitle = element.querySelector('.game_title, .gameListRowItemName, h1')?.textContent?.trim();
    const appId = element.getAttribute('data-ds-appid') ||
                  element.querySelector('[data-ds-appid]')?.getAttribute('data-ds-appid');

    if (gameTitle) {
      console.log('Owned game detected:', gameTitle);

      chrome.runtime.sendMessage({
        action: 'ownedGamesDetected',
        data: {
          title: gameTitle,
          appId: appId,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          source: 'content_script'
        }
      });
    }
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);

        addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const gameRows = node.querySelectorAll('.gameListRow, .license_row');
            gameRows.forEach((row) => {
              const gameTitle = row.querySelector('.gameListRowItemName, .game_title')?.textContent?.trim();
              if (gameTitle) {
                chrome.runtime.sendMessage({
                  action: 'ownedGamesDetected',
                  data: {
                    title: gameTitle,
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    source: 'mutation_observer'
                  }
                });
              }
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const pageType = detectSteamPageType();
    console.log('Steam page type:', pageType);
    monitorSteamPurchases();

    if (pageType === 'licenses_page' || pageType === 'purchase_history_page' || pageType === 'profile_page') {
      monitorOwnedGames();
    }
  });
} else {
  const pageType = detectSteamPageType();
  console.log('Steam page type:', pageType);
  monitorSteamPurchases();

  if (pageType === 'licenses_page' || pageType === 'purchase_history_page' || pageType === 'profile_page') {
    monitorOwnedGames();
  }
}
