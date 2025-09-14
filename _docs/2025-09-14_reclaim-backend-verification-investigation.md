# Reclaim Protocol バックエンド検証方法の調査

## 現在の実装状況

### 既存コード構造

1. **server/src/reclaim.ts**
   - `verifyProof()` 関数が実装済み
   - モックモードと本番モードの切り替え対応
   - `@reclaimprotocol/js-sdk` の `verifyProof` を使用

2. **server/src/routes/zkp.ts**
   - `/zkp/verify` エンドポイントで検証を実行
   - 検証後、データベースに保存

## バックエンド検証の実装方法

### 現在の実装 (server/src/reclaim.ts:56-64)

```typescript
export async function verifyProof(proof: ProofInput) {
  if (ZKP_MOCK) {
    return { verified: true, reason: 'mock-mode' }
  }

  const { verifyProof } = await import('@reclaimprotocol/js-sdk')
  const ok = await verifyProof(proof.payload)
  return { verified: !!ok, reason: ok ? 'verified' : 'invalid' }
}
```

### 入力データ構造

```typescript
export const ProofSchema = z.object({
  sessionId: z.string().optional(),
  provider: z.string().default('steam'),
  payload: z.any()  // 実際のproof データ
})
```

## 検証フロー

1. **クライアント側**
   - ユーザーがReclaim Protocolでproofを生成
   - 生成されたproofをバックエンドに送信

2. **バックエンド側 (/zkp/verify)**
   - ProofSchemaでリクエストデータを検証
   - `verifyProof()` 関数でproofの真正性を確認
   - 検証結果をデータベースに保存
   - レスポンスを返す

## 重要なポイント

### 環境変数設定
```
ZKP_MOCK=true/false  # モックモードの切り替え
RECLAIM_APP_ID=xxx   # Reclaim App ID（本番用）
RECLAIM_APP_SECRET=xxx  # Reclaim App Secret（本番用）
RECLAIM_PROVIDER_ID=xxx  # Provider ID
```

### 検証に必要なデータ
- **payload**: クライアントから受け取ったproof全体のデータ
- SDKの`verifyProof()`が自動的に以下を検証:
  - 署名の有効性
  - データの整合性
  - タイムスタンプの有効性

### データベース保存 (server/src/routes/zkp.ts:31-39)
```typescript
await prisma.proof.create({
  data: {
    userId: user.id,
    gameId: game?.id,
    provider: parse.data.provider,
    verified: result.verified,
    proofJson: parse.data.payload  // 元のproofデータを保存
  }
})
```

## 改善提案

1. **エラーハンドリングの強化**
   - 検証失敗時の詳細なエラー情報
   - タイムアウト処理

2. **セキュリティ対策**
   - レート制限
   - 重複proof検証の防止
   - sessionIdの有効期限チェック

3. **ログ記録**
   - 検証試行の記録
   - 失敗パターンの分析

## まとめ

現在の実装で基本的なバックエンド検証は動作している：
- `@reclaimprotocol/js-sdk`の`verifyProof()`でproofの真正性を確認
- 検証結果はデータベースに保存
- モックモードで開発時のテストが容易

本番環境では環境変数を適切に設定し、`ZKP_MOCK=false`にすることで実際の検証が動作する。