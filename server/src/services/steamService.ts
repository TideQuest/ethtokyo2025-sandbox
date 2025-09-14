interface SteamGameInfo {
  appId: number | null;
  url: string | null;
  found: boolean;
}

interface SteamApiGame {
  appid: number;
  name: string;
}

interface SteamApiResponse {
  applist: {
    apps: SteamApiGame[];
  };
}

class SteamService {
  private static instance: SteamService;
  private gameCache = new Map<string, SteamGameInfo>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): SteamService {
    if (!SteamService.instance) {
      SteamService.instance = new SteamService();
    }
    return SteamService.instance;
  }

  private normalizeGameName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isCacheValid(gameName: string): boolean {
    const expiry = this.cacheExpiry.get(gameName);
    return expiry !== undefined && Date.now() < expiry;
  }

  async searchGameAppId(gameName: string): Promise<SteamGameInfo> {
    const normalizedName = this.normalizeGameName(gameName);

    // Check cache first
    if (this.gameCache.has(normalizedName) && this.isCacheValid(normalizedName)) {
      return this.gameCache.get(normalizedName)!;
    }

    try {
      console.log(`Searching Steam for game: ${gameName}`);

      // Use Steam Web API to search for games
      const response = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/');

      if (!response.ok) {
        throw new Error(`Steam API request failed: ${response.status}`);
      }

      const data: SteamApiResponse = await response.json();

      // Search for the game in the app list
      const normalizedSearchName = this.normalizeGameName(gameName);
      const matchedApp = data.applist.apps.find(app =>
        this.normalizeGameName(app.name) === normalizedSearchName
      );

      let result: SteamGameInfo;

      if (matchedApp) {
        result = {
          appId: matchedApp.appid,
          url: `https://store.steampowered.com/app/${matchedApp.appid}/`,
          found: true
        };
        console.log(`Found Steam game: ${gameName} -> AppID: ${matchedApp.appid}`);
      } else {
        // Try partial matching as fallback
        const partialMatch = data.applist.apps.find(app =>
          this.normalizeGameName(app.name).includes(normalizedSearchName) ||
          normalizedSearchName.includes(this.normalizeGameName(app.name))
        );

        if (partialMatch) {
          result = {
            appId: partialMatch.appid,
            url: `https://store.steampowered.com/app/${partialMatch.appid}/`,
            found: true
          };
          console.log(`Found partial Steam match: ${gameName} -> ${partialMatch.name} (AppID: ${partialMatch.appid})`);
        } else {
          result = {
            appId: null,
            url: null,
            found: false
          };
          console.log(`No Steam match found for: ${gameName}`);
        }
      }

      // Cache the result
      this.gameCache.set(normalizedName, result);
      this.cacheExpiry.set(normalizedName, Date.now() + this.CACHE_DURATION);

      return result;
    } catch (error) {
      console.error(`Error searching Steam for ${gameName}:`, error);

      // Return cached result if available, otherwise return not found
      const cachedResult = this.gameCache.get(normalizedName);
      if (cachedResult) {
        return cachedResult;
      }

      return {
        appId: null,
        url: null,
        found: false
      };
    }
  }

  async enrichGameWithSteamInfo(gameName: string): Promise<{
    name: string;
    steamAppId: number | null;
    steamUrl: string | null;
  }> {
    const steamInfo = await this.searchGameAppId(gameName);

    return {
      name: gameName,
      steamAppId: steamInfo.appId,
      steamUrl: steamInfo.url
    };
  }
}

export const steamService = SteamService.getInstance();
export type { SteamGameInfo };