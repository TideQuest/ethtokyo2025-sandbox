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
      // Fetch Steam app list
      const response = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
      const data: SteamApiResponse = await response.json();

      if (!data?.applist?.apps) {
        return this.cacheAndReturn(normalizedName, {
          appId: null,
          url: null,
          found: false
        });
      }

      // Find exact match first
      let matchedGame = data.applist.apps.find(
        app => this.normalizeGameName(app.name) === normalizedName
      );

      // If no exact match, try partial match
      if (!matchedGame) {
        matchedGame = data.applist.apps.find(app => {
          const appNameNormalized = this.normalizeGameName(app.name);
          return appNameNormalized.includes(normalizedName) ||
                 normalizedName.includes(appNameNormalized);
        });
      }

      // If still no match, try fuzzy match
      if (!matchedGame) {
        const nameWords = normalizedName.split(' ');
        matchedGame = data.applist.apps.find(app => {
          const appNameNormalized = this.normalizeGameName(app.name);
          return nameWords.every(word => appNameNormalized.includes(word));
        });
      }

      if (matchedGame) {
        const steamInfo: SteamGameInfo = {
          appId: matchedGame.appid,
          url: `https://store.steampowered.com/app/${matchedGame.appid}`,
          found: true
        };
        return this.cacheAndReturn(normalizedName, steamInfo);
      }

      return this.cacheAndReturn(normalizedName, {
        appId: null,
        url: null,
        found: false
      });
    } catch (error) {
      console.error('Error searching Steam app:', error);
      return {
        appId: null,
        url: null,
        found: false
      };
    }
  }

  private cacheAndReturn(gameName: string, info: SteamGameInfo): SteamGameInfo {
    this.gameCache.set(gameName, info);
    this.cacheExpiry.set(gameName, Date.now() + this.CACHE_DURATION);
    return info;
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
