import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { getCuratorPrompt } from '../config/curators.js';

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
      model: process.env.OLLAMA_MODEL || 'llama3',
      temperature: 0.7,
      numCtx: 2048
    });
  }
};

const llm = getLLM();

export async function getCuratorRecommendation(
  curatorId: string, 
  game: string
): Promise<{ curator: string; inputGame: string; recommendations: any[]; processingTime: number }> {
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
        const validRecommendations = parsed.recommendations.filter(rec =>
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
        console.warn('推薦配列が無効、フォールバック使用');
        recommendations = getFallbackRecommendations(curatorId, game);
      }
    } catch (parseError) {
      console.warn('JSON解析に失敗、フォールバック使用:', parseError);
      console.warn('パース対象コンテンツ:', content.substring(0, 500));
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
    console.error('キュレーター推薦エラー:', error);
    const processingTime = (Date.now() - startTime) / 1000;
    
    return {
      curator: curatorId,
      inputGame: game,
      recommendations: getFallbackRecommendations(curatorId, game),
      processingTime
    };
  }
}

function getFallbackRecommendations(curatorId: string, inputGame: string): any[] {
  const fallbacks = {
    vita: [
      {
        name: "Outer Wilds",
        reason: `${inputGame}の探索要素を宇宙規模の謎解きと時間ループで表現した没入型アドベンチャー`,
        category: "immersive"
      },
      {
        name: "Subnautica",
        reason: `${inputGame}のような世界観を深海の恐怖と美しさで体験できる究極の没入型サバイバル`,
        category: "immersive"
      },
      {
        name: "The Stanley Parable: Ultra Deluxe",
        reason: `${inputGame}の物語性をメタ的な視点と選択の意味を問う革新的な体験で表現`,
        category: "immersive"
      }
    ],
    indie: [
      {
        name: "Gris",
        reason: `${inputGame}と同じく深い感情的な物語を美しいアートスタイルで表現した傑作`,
        category: "indie"
      },
      {
        name: "Outer Wilds",
        reason: `${inputGame}の探求心を宇宙規模の時間ループという独創的な仕組みで実現`,
        category: "indie"
      },
      {
        name: "The Stanley Parable",
        reason: `${inputGame}のようにプレイヤーの選択と物語の関係を革新的に表現したメタゲーム`,
        category: "indie"
      }
    ],
    core: [
      {
        name: "Sekiro: Shadows Die Twice",
        reason: `${inputGame}の技術的挑戦を完璧なタイミングと反射神経で極限まで高めたアクションゲーム`,
        category: "hardcore"
      },
      {
        name: "The Binding of Isaac",
        reason: `${inputGame}の戦略性をローグライクの運と技術の両方が必要な高難易度システムで実現`,
        category: "hardcore"
      },
      {
        name: "Spelunky 2",
        reason: `${inputGame}の精密な操作要求を毎回異なる状況判断が求められる究極の2Dプラットフォーマーで体現`,
        category: "hardcore"
      }
    ]
  };

  return fallbacks[curatorId] || fallbacks.vita;
}
