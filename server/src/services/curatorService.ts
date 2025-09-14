import { ChatOllama } from '@langchain/ollama';
import { getCuratorPrompt, getFallbackRecommendations } from '../config/curators.js';

const llm = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:1b',
  temperature: 0.7,
  numCtx: 2048
});

interface Recommendation {
  name: string;
  reason: string;
  category: string;
}

export interface CuratorRecommendation {
  curator: string;
  inputGame: string;
  recommendations: Recommendation[];
  processingTime: number;
}

export async function getCuratorRecommendation(
  curatorId: string,
  game: string
): Promise<CuratorRecommendation> {
  const startTime = Date.now();

  try {
    const prompt = getCuratorPrompt(curatorId, game);

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : String(response.content);

    console.log('LLM Response:', content.substring(0, 200) + '...');

    let recommendations: Recommendation[];
    try {
      const cleanContent = content.trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleanContent;

      const parsed = JSON.parse(jsonString);

      if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
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

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      curator: curatorId,
      inputGame: game,
      recommendations,
      processingTime
    };
  } catch (error) {
    console.error('Curator recommendation error:', error);
    const processingTime = (Date.now() - startTime) / 1000;

    return {
      curator: curatorId,
      inputGame: game,
      recommendations: getFallbackRecommendations(curatorId, game),
      processingTime
    };
  }
}