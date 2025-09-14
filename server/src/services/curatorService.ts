import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { getCuratorPrompt, getFallbackRecommendations } from '../config/curators.js';
import { steamService } from './steamService.js';

// 環境変数でLLMプロバイダーを選択
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama'

const getLLM = () => {
  if (LLM_PROVIDER === 'gemini') {
    return new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-flash',
      temperature: 0.7,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  } else {
    return new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2:1b',
      temperature: 0.7,
      numCtx: 2048
    });
  }
};

const llm = getLLM();

interface EnrichedRecommendation {
  name: string;
  reason: string;
  category: string;
  steamAppId: number | null;
  steamUrl: string | null;
}

export async function getCuratorRecommendation(
  curatorId: string,
  game: string
): Promise<{ curator: string; inputGame: string; recommendations: EnrichedRecommendation[]; processingTime: number }> {
  const startTime = Date.now();

  try {
    const prompt = getCuratorPrompt(curatorId, game);

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : String(response.content);

    console.log('LLM Response:', content.substring(0, 200) + '...');

    // JSONパースを試行
    let recommendations;
    try {
      // JSONの前後の余分な文字列を除去
      const cleanContent = content.trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleanContent;

      const parsed = JSON.parse(jsonString);

      // 推薦配列の検証
      if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        // 各推薦項目の検証
        const validRecommendations = parsed.recommendations.filter((rec: any) =>
          rec.name &&
          rec.reason &&
          rec.category &&
          typeof rec.name === 'string' &&
          typeof rec.reason === 'string' &&
          rec.name.trim().length > 0 &&
          rec.reason.trim().length > 0
        );

        recommendations = validRecommendations.length > 0 ? validRecommendations : getFallbackRecommendations(curatorId, game);
      } else {
        console.warn('Invalid recommendations array, using fallback');
        recommendations = getFallbackRecommendations(curatorId, game);
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON, using fallback:', parseError);
      console.warn('Content to parse:', content.substring(0, 500));
      recommendations = getFallbackRecommendations(curatorId, game);
    }

    // Enrich recommendations with Steam information
    const enrichedRecommendations: EnrichedRecommendation[] = await Promise.all(
      recommendations.map(async (rec: any) => {
        const steamInfo = await steamService.enrichGameWithSteamInfo(rec.name);
        return {
          name: rec.name,
          reason: rec.reason,
          category: rec.category,
          steamAppId: steamInfo.steamAppId,
          steamUrl: steamInfo.steamUrl
        };
      })
    );

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      curator: curatorId,
      inputGame: game,
      recommendations: enrichedRecommendations,
      processingTime
    };
  } catch (error) {
    console.error('Curator recommendation error:', error);
    const processingTime = (Date.now() - startTime) / 1000;

    // Enrich fallback recommendations with Steam information
    const fallbackRecs = getFallbackRecommendations(curatorId, game);
    const enrichedFallbackRecommendations: EnrichedRecommendation[] = await Promise.all(
      fallbackRecs.map(async (rec: any) => {
        const steamInfo = await steamService.enrichGameWithSteamInfo(rec.name);
        return {
          name: rec.name,
          reason: rec.reason,
          category: rec.category,
          steamAppId: steamInfo.steamAppId,
          steamUrl: steamInfo.steamUrl
        };
      })
    );

    return {
      curator: curatorId,
      inputGame: game,
      recommendations: enrichedFallbackRecommendations,
      processingTime
    };
  }
}