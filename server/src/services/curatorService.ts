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
      const parsed = JSON.parse(content);
      recommendations = parsed.recommendations || [];
    } catch (parseError) {
      console.warn('JSON解析に失敗、フォールバック使用:', parseError);
      recommendations = getFallbackRecommendations(curatorId);
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
      recommendations: getFallbackRecommendations(curatorId),
      processingTime
    };
  }
}

function getFallbackRecommendations(curatorId: string): any[] {
  const fallbacks = {
    vita: [
      { name: "Fruit Ninja VR 2", reason: "VR斬撃ゲームの傑作", category: "vr" },
      { name: "The Lab", reason: "VR操作性の実験集", category: "vr" },
      { name: "SUPERHOT VR", reason: "時間の概念を変えるVRゲーム", category: "vr" }
    ],
    indie: [
      { name: "The Talos Principle", reason: "哲学的パズルゲーム", category: "indie" },
      { name: "Hollow Knight", reason: "美しいアートのメトロイドヴァニア", category: "indie" },
      { name: "Celeste", reason: "高難度のプラットフォーマー", category: "indie" }
    ],
    core: [
      { name: "Hollow Knight", reason: "繊細な操作が要求される", category: "hardcore" },
      { name: "Celeste", reason: "高難度のプラットフォーマー", category: "hardcore" },
      { name: "Dark Souls III", reason: "究極の難易度設計", category: "hardcore" }
    ]
  };
  
  return fallbacks[curatorId] || fallbacks.vita;
}
