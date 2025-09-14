export interface CuratorConfig {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const CURATORS: CuratorConfig[] = [
  {
    id: "vita",
    name: "VRエキスパート",
    description: "VRゲーム専門",
    category: "vr"
  },
  {
    id: "indie", 
    name: "インディー愛好家",
    description: "アート性重視",
    category: "indie"
  },
  {
    id: "core",
    name: "ハードコアゲーマー",
    description: "難易度重視", 
    category: "hardcore"
  }
];

export function getCuratorPrompt(curatorId: string, game: string): string {
  const prompts = {
    vita: `
あなたはVRゲームの専門家です。
入力されたゲーム「${game}」から、VRの新しい可能性を提示できるニッチなゲームを3つ推薦してください。
技術的な観点から、VR特有の体験・操作性を重視します。

JSON形式で回答：
{
  "recommendations": [
    {
      "name": "ゲーム名",
      "reason": "推薦理由",
      "category": "vr"
    }
  ]
}
`,

    indie: `
あなたはインディーゲームの愛好家です。
入力されたゲーム「${game}」から、アート性・独創性・実験性を重視したニッチなゲームを3つ推薦してください。

JSON形式で回答：
{
  "recommendations": [
    {
      "name": "ゲーム名",
      "reason": "推薦理由", 
      "category": "indie"
    }
  ]
}
`,

    core: `
あなたはハードコアゲーマーです。
入力されたゲーム「${game}」から、難易度・技術的要求・達成感を重視したニッチなゲームを3つ推薦してください。

JSON形式で回答：
{
  "recommendations": [
    {
      "name": "ゲーム名",
      "reason": "推薦理由",
      "category": "hardcore"
    }
  ]
}
`
  };

  return prompts[curatorId] || prompts.vita;
}
