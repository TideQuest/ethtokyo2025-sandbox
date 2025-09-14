let steamUserData = null;
let lastFetchTime = 0;


async function fetchSteamUserData() {
  const now = Date.now();

  if (lastFetchTime && (now - lastFetchTime) < 60000) {
    console.log('Data fetched recently, using cached data');
    return steamUserData;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url.includes('steampowered.com') && !currentTab.url.includes('steamcommunity.com')) {
      throw new Error('Please visit Steam website first');
    }

    const userDataUrl = await findUserDataUrl(currentTab.id);

    if (!userDataUrl) {
      throw new Error('Could not determine Steam user ID. Please make sure you are logged in.');
    }

    console.log('Fetching Steam userdata from:', userDataUrl);

    const response = await fetch(userDataUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    let userData = parseSteamUserData(responseText);

    userData = await enrichGameData(userData);

    steamUserData = {
      ...userData,
      fetchTime: new Date().toISOString(),
      sourceUrl: userDataUrl
    };

    lastFetchTime = now;

    chrome.storage.local.set({
      steamUserData: steamUserData
    });

    return steamUserData;

  } catch (error) {
    console.error('Error fetching Steam userdata:', error);
    throw error;
  }
}

async function findUserDataUrl(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        console.log('Searching for Steam ID...');

        const patterns = [
          /g_steamID\s*=\s*"(\d+)"/,
          /g_steamID\s*=\s*'(\d+)'/,
          /"steamid":\s*"(\d+)"/,
          /"steamid":\s*(\d+)/,
          /dynamicstore\/userdata\/\?id=(\d+)/,
          /steamcommunity\.com\/profiles\/(\d+)/,
          /COMMUNITY_BASE_URL\s*=\s*"[^"]*\/profiles\/(\d+)/,
          /"current_steamid":\s*"(\d+)"/,
          /window\.g_steamID\s*=\s*"(\d+)"/,
          /var g_steamID\s*=\s*"(\d+)"/
        ];

        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent || script.innerHTML;
          if (!content) continue;

          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
              const steamId = match[1];
              console.log(`Found Steam ID: ${steamId} using pattern: ${pattern}`);
              return {
                steamId: steamId,
                url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
                method: 'script_pattern'
              };
            }
          }
        }

        const profileLinks = document.querySelectorAll('a[href*="/profiles/"]');
        for (const link of profileLinks) {
          const href = link.href;
          const match = href.match(/\/profiles\/(\d+)/);
          if (match && match[1]) {
            const steamId = match[1];
            console.log(`Found Steam ID from profile link: ${steamId}`);
            return {
              steamId: steamId,
              url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
              method: 'profile_link'
            };
          }
        }

        const metaTags = document.querySelectorAll('meta[property*="steamid"], meta[name*="steamid"]');
        for (const meta of metaTags) {
          const content = meta.getAttribute('content');
          if (content && /^\d+$/.test(content)) {
            console.log(`Found Steam ID from meta tag: ${content}`);
            return {
              steamId: content,
              url: `https://store.steampowered.com/dynamicstore/userdata/?id=${content}&cc=JP`,
              method: 'meta_tag'
            };
          }
        }

        const currentUrl = window.location.href;
        const urlMatch = currentUrl.match(/\/profiles\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
          const steamId = urlMatch[1];
          console.log(`Found Steam ID from current URL: ${steamId}`);
          return {
            steamId: steamId,
            url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
            method: 'current_url'
          };
        }

        console.log('No Steam ID found');
        return null;
      }
    });

    const result = results[0]?.result;
    if (result) {
      console.log(`Steam ID detection successful: ${result.steamId} (method: ${result.method})`);
      return result.url;
    }

    return null;
  } catch (error) {
    console.error('Error finding Steam user ID:', error);
    return null;
  }
}

function parseSteamUserData(responseText) {
  try {
    const jsonData = JSON.parse(responseText);

    const userData = {
      steamId: jsonData.steamid || 'unknown',
      countryCode: jsonData.country_code || 'JP',
      ownedGames: [],
      wishlist: [],
      recentlyPlayed: [],
      accountBalance: jsonData.wallet ? jsonData.wallet.formatted_balance : 'unknown',
      recommendedTags: [],
      hardwareUsed: jsonData.rgHardwareUsed || [],
      primaryLanguage: jsonData.rgPrimaryLanguage || 'unknown'
    };

    if (jsonData.rgOwnedApps && Array.isArray(jsonData.rgOwnedApps)) {
      userData.ownedGames = jsonData.rgOwnedApps.map(appId => ({
        appId: appId.toString(),
        name: `App ${appId}`,
        playtime: 0,
        source: 'rgOwnedApps'
      }));
    }

    if (jsonData.rgWishlist && Array.isArray(jsonData.rgWishlist)) {
      userData.wishlist = jsonData.rgWishlist.map(appId => ({
        appId: appId.toString(),
        name: `App ${appId}`,
        priority: 0,
        source: 'rgWishlist'
      }));
    }

    if (jsonData.rgRecommendedTags && Array.isArray(jsonData.rgRecommendedTags)) {
      userData.recommendedTags = jsonData.rgRecommendedTags.map(tag => ({
        tagId: tag.tagid,
        name: tag.name
      }));
    }

    if (jsonData.rgRecentlyPlayed && Array.isArray(jsonData.rgRecentlyPlayed)) {
      userData.recentlyPlayed = jsonData.rgRecentlyPlayed.map(game => ({
        appId: game.appid,
        name: game.name,
        playtime2weeks: game.playtime_2weeks || 0,
        playtimeForever: game.playtime_forever || 0
      }));
    }

    if (jsonData.rgOwnedPackages && Array.isArray(jsonData.rgOwnedPackages)) {
      userData.ownedPackages = jsonData.rgOwnedPackages.filter(pkg => pkg !== 0);
    }

    if (jsonData.rgRecommendedApps && Array.isArray(jsonData.rgRecommendedApps)) {
      userData.recommendedApps = jsonData.rgRecommendedApps.slice(0, 20);
    }

    console.log('Parsed Steam userdata:', {
      ownedGames: userData.ownedGames.length,
      wishlist: userData.wishlist.length,
      recommendedTags: userData.recommendedTags.length,
      hardwareUsed: userData.hardwareUsed,
      primaryLanguage: userData.primaryLanguage
    });

    return userData;

  } catch (error) {
    console.error('Error parsing Steam userdata JSON:', error);
    return {
      error: 'Failed to parse Steam userdata',
      rawResponse: responseText.substring(0, 1000),
      parseError: error.message
    };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'fetchSteamUserData') {
    fetchSteamUserData()
      .then(userData => {
        sendResponse({ success: true, data: userData });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'fetchSteamUserDataManual') {
    if (!request.steamId) {
      sendResponse({ success: false, error: 'Steam ID is required' });
      return;
    }

    fetchSteamUserDataManual(request.steamId)
      .then(userData => {
        sendResponse({ success: true, data: userData });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getSteamUserData') {
    chrome.storage.local.get(['steamUserData'], (result) => {
      sendResponse(result.steamUserData || null);
    });
    return true;
  }

  if (request.action === "getUserDataUrlAndCookies") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const currentTab = tabs[0];
        if (!currentTab) throw new Error("No active tab");

        if (
          !currentTab.url ||
          (!currentTab.url.includes("steampowered.com") &&
            !currentTab.url.includes("steamcommunity.com"))
        ) {
          throw new Error("Please visit Steam website first");
        }

        // Reuse the existing detector to build the userdata URL
        const userDataInfo = await (async () => {
          const results = await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: () => {
              const patterns = [
                /g_steamID\s*=\s*"(\d+)"/,
                /g_steamID\s*=\s*'(\d+)'/,
                /"steamid":\s*"(\d+)"/,
                /"steamid":\s*(\d+)/,
                /dynamicstore\/userdata\/\?id=(\d+)/,
                /steamcommunity\.com\/profiles\/(\d+)/,
                /COMMUNITY_BASE_URL\s*=\s*"[^"]*\/profiles\/(\d+)/,
                /"current_steamid":\s*"(\d+)"/,
                /window\.g_steamID\s*=\s*"(\d+)"/,
                /var g_steamID\s*=\s*"(\d+)"/,
              ];
              const scripts = document.querySelectorAll("script");
              for (const script of scripts) {
                const content = script.textContent || script.innerHTML;
                if (!content) continue;
                for (const pattern of patterns) {
                  const match = content.match(pattern);
                  if (match && match[1]) {
                    const steamId = match[1];
                    return {
                      steamId,
                      url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
                    };
                  }
                }
              }
              const currentUrl = window.location.href;
              const urlMatch = currentUrl.match(/\/profiles\/(\d+)/);
              if (urlMatch && urlMatch[1]) {
                const steamId = urlMatch[1];
                return {
                  steamId,
                  url: `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`,
                };
              }
              return null;
            },
          });
          return results[0]?.result;
        })();

        if (!userDataInfo) throw new Error("Could not determine Steam user ID");

        // Build cookie string for store.steampowered.com
        const cookies = await chrome.cookies.getAll({
          domain: "steampowered.com",
        });
        const storeCookies = cookies.filter(
          (c) =>
            c.domain.endsWith("steampowered.com") ||
            c.domain.endsWith(".steampowered.com")
        );
        const cookieStr = storeCookies
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");

        sendResponse({ success: true, data: { ...userDataInfo, cookieStr } });
      } catch (err) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  // Get Ethereum address from the currently active tab page context
  if (request.action === 'getEthereumAddress') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        if (!currentTab) throw new Error('No active tab');

        // Guard against restricted schemes where injection isn't allowed
        const url = currentTab.url || '';
        const isRestricted =
          url.startsWith('chrome://') ||
          url.startsWith('edge://') ||
          url.startsWith('about:') ||
          url.startsWith('chrome-extension://') ||
          url.startsWith('https://chrome.google.com/webstore');
        if (isRestricted) {
          sendResponse({ success: true, data: { connected: false, account: null, error: 'Restricted page (cannot inject)' } });
          return;
        }

        const [result] = await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          world: 'MAIN',
          func: async () => {
            try {
              const eth = window.ethereum;
              if (!eth) {
                return { connected: false, account: null, error: 'No Ethereum provider on page' };
              }
              // Prefer eth_accounts to avoid prompting; only returns when already connected
              let accounts = [];
              try {
                accounts = await eth.request({ method: 'eth_accounts' });
              } catch (e) {
                // Some providers might restrict eth_accounts; fall back to selectedAddress if present
                accounts = [];
              }
              const account = (accounts && accounts.length) ? accounts[0] : (eth.selectedAddress || null);
              return { connected: !!account, account };
            } catch (e) {
              return { connected: false, account: null, error: e?.message || String(e) };
            }
          },
        });

        sendResponse({ success: true, data: result?.result || { connected: false, account: null } });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  // No connect flow from extension; read-only address check only.

  if (request.action === 'clearData') {
    steamUserData = null;
    lastFetchTime = 0;
    chrome.storage.local.clear();
    sendResponse({ success: true });
  }
});

async function fetchAppDetails(appIds) {
  if (!appIds || appIds.length === 0) {
    console.log('No app IDs to fetch');
    return {};
  }

  console.log(`Fetching details for ${appIds.length} apps:`, appIds.slice(0, 10));

  const appDetailsCache = {};
  const batchSize = 5; // Reduce batch size for better reliability

  for (let i = 0; i < appIds.length; i += batchSize) {
    const batch = appIds.slice(i, i + batchSize);
    const appIdsString = batch.join(',');
    const url = `https://store.steampowered.com/api/appdetails?appids=${appIdsString}&l=japanese&cc=JP`;

    console.log(`Fetching batch ${i + 1}-${Math.min(i + batchSize, appIds.length)}: ${url}`);

    try {
      // Try individual requests instead of batch requests
      const responses = [];
      for (const appId of batch) {
        try {
          const singleUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=JP`;
          console.log(`Fetching individual app ${appId}: ${singleUrl}`);

          const singleResponse = await fetch(singleUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (singleResponse.ok) {
            const singleData = await singleResponse.json();
            console.log(`Full response for app ${appId}:`, singleData);

            if (singleData[appId]) {
              if (singleData[appId].success && singleData[appId].data) {
                const appData = singleData[appId].data;
                appDetailsCache[appId] = {
                  name: appData.name,
                  type: appData.type,
                  is_free: appData.is_free,
                  developers: appData.developers,
                  publishers: appData.publishers,
                  categories: appData.categories,
                  genres: appData.genres,
                  release_date: appData.release_date
                };
                console.log(`Successfully cached app ${appId}: ${appData.name}`);
              } else {
                console.log(`App ${appId} failed - success: ${singleData[appId].success}`);
                console.log(`Failure reason:`, singleData[appId]);

                // For failed apps, create a fallback entry
                appDetailsCache[appId] = {
                  name: `[削除済み] App ${appId}`,
                  type: 'unknown',
                  is_free: null,
                  developers: ['不明'],
                  publishers: ['不明'],
                  categories: [],
                  genres: [{ id: 'unknown', description: '削除済みアプリ' }],
                  release_date: { coming_soon: false, date: '不明' }
                };
                console.log(`Created fallback entry for deleted app ${appId}`);
              }
            } else {
              console.log(`No response data for app ${appId} in:`, Object.keys(singleData));

              // Create fallback for no response data
              appDetailsCache[appId] = {
                name: `[不明] App ${appId}`,
                type: 'unknown',
                is_free: null,
                developers: ['不明'],
                publishers: ['不明'],
                categories: [],
                genres: [{ id: 'unknown', description: '情報取得失敗' }],
                release_date: { coming_soon: false, date: '不明' }
              };
              console.log(`Created fallback entry for no-data app ${appId}`);
            }
          } else {
            console.error(`HTTP ${singleResponse.status} for app ${appId}`);
            const errorText = await singleResponse.text();
            console.error(`Error response for ${appId}:`, errorText.substring(0, 200));

            // Create fallback for HTTP error
            appDetailsCache[appId] = {
              name: `[エラー] App ${appId}`,
              type: 'unknown',
              is_free: null,
              developers: ['不明'],
              publishers: ['不明'],
              categories: [],
              genres: [{ id: 'unknown', description: `HTTPエラー ${singleResponse.status}` }],
              release_date: { coming_soon: false, date: '不明' }
            };
            console.log(`Created fallback entry for HTTP error app ${appId}`);
          }

          // Delay between individual requests
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (singleError) {
          console.error(`Error fetching app ${appId}:`, singleError);

          // Create fallback for network/fetch error
          appDetailsCache[appId] = {
            name: `[接続エラー] App ${appId}`,
            type: 'unknown',
            is_free: null,
            developers: ['不明'],
            publishers: ['不明'],
            categories: [],
            genres: [{ id: 'unknown', description: '接続エラー' }],
            release_date: { coming_soon: false, date: '不明' }
          };
          console.log(`Created fallback entry for network error app ${appId}`);
        }
      }

      continue; // Skip the batch request code below

      console.log(`Response status: ${response.status} for batch ${i + 1}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`Response data keys:`, Object.keys(data));

        for (const appId of batch) {
          console.log(`Processing app ${appId}:`, {
            exists: !!data[appId],
            success: data[appId]?.success,
            hasData: !!data[appId]?.data
          });

          if (data[appId] && data[appId].success && data[appId].data) {
            const appData = data[appId].data;
            appDetailsCache[appId] = {
              name: appData.name,
              type: appData.type,
              is_free: appData.is_free,
              developers: appData.developers,
              publishers: appData.publishers,
              categories: appData.categories,
              genres: appData.genres,
              release_date: appData.release_date
            };
            console.log(`Successfully cached app ${appId}: ${appData.name}`);
          } else {
            console.log(`Failed to get data for app ${appId}:`, data[appId]);
          }
        }
      } else {
        console.error(`HTTP ${response.status} for batch ${i + 1}`);
        const responseText = await response.text();
        console.error(`Error response body:`, responseText);
      }

      // Longer delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`Error fetching app details for batch ${i}-${i + batchSize}:`, error);
    }
  }

  console.log(`Final cache contains ${Object.keys(appDetailsCache).length} apps:`, Object.keys(appDetailsCache));
  return appDetailsCache;
}

async function enrichGameData(userData) {
  if (!userData.ownedGames || userData.ownedGames.length === 0) {
    console.log('No owned games to enrich');
    return userData;
  }

  console.log(`Starting enrichment for ${userData.ownedGames.length} owned games`);

  // Get all owned games
  const appIds = userData.ownedGames.map(game => game.appId);
  console.log('App IDs to enrich (all games):', appIds);

  try {
    const appDetails = await fetchAppDetails(appIds);
    console.log('App details received:', appDetails);

    console.log('Available app details:', Object.keys(appDetails));

    userData.ownedGames = userData.ownedGames.map(game => {
      if (appDetails[game.appId]) {
        console.log(`Enriching game ${game.appId} with:`, appDetails[game.appId].name);
        return {
          ...game,
          name: appDetails[game.appId].name,
          type: appDetails[game.appId].type,
          developers: appDetails[game.appId].developers,
          genres: appDetails[game.appId].genres
        };
      } else {
        console.log(`No details found for game ${game.appId} (available: ${Object.keys(appDetails).join(', ')})`);
      }
      return game;
    });
  } catch (error) {
    console.error('Error during game enrichment:', error);
    // Continue without enrichment if API fails
  }

  // Also enrich wishlist if available
  if (userData.wishlist && userData.wishlist.length > 0) {
    console.log(`Starting enrichment for ${userData.wishlist.length} wishlist items`);
    const wishlistAppIds = userData.wishlist.map(item => item.appId);

    try {
      const wishlistDetails = await fetchAppDetails(wishlistAppIds);
      console.log('Wishlist details received:', wishlistDetails);

      userData.wishlist = userData.wishlist.map(item => {
        if (wishlistDetails[item.appId]) {
          return {
            ...item,
            name: wishlistDetails[item.appId].name,
            type: wishlistDetails[item.appId].type,
            developers: wishlistDetails[item.appId].developers,
            genres: wishlistDetails[item.appId].genres
          };
        }
        return item;
      });
    } catch (error) {
      console.error('Error during wishlist enrichment:', error);
    }
  }

  console.log('Enrichment completed');
  return userData;
}

async function fetchSteamUserDataManual(steamId) {
  const now = Date.now();

  if (lastFetchTime && (now - lastFetchTime) < 60000) {
    console.log('Data fetched recently, using cached data');
    return steamUserData;
  }

  try {
    const userDataUrl = `https://store.steampowered.com/dynamicstore/userdata/?id=${steamId}&cc=JP`;

    console.log('Fetching Steam userdata from (manual):', userDataUrl);

    const response = await fetch(userDataUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    let userData = parseSteamUserData(responseText);

    userData = await enrichGameData(userData);

    steamUserData = {
      ...userData,
      fetchTime: new Date().toISOString(),
      sourceUrl: userDataUrl,
      fetchMethod: 'manual'
    };

    lastFetchTime = now;

    chrome.storage.local.set({
      steamUserData: steamUserData
    });

    return steamUserData;

  } catch (error) {
    console.error('Error fetching Steam userdata (manual):', error);
    throw error;
  }
}
