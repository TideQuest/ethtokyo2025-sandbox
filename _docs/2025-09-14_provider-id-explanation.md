# Provider ID の説明

## Provider IDとは？

Provider IDは、Reclaim Protocolにおいて**どのサービス/データソースを検証するか**を指定する一意の識別子です。

## 目的

1. **サービス識別**: 検証したいサービス（Google、Steam、Uber等）を特定
2. **検証フロー設定**: どのような検証ロジックを使用するかを決定
3. **データ抽出方法の指定**: 各サービスに応じた適切なデータ取得方法を設定

## 必須かどうか

### 本番環境（ZKP_MOCK=false）
- **必須**: Provider IDがないと、どのサービスを検証するか分からない
- 環境変数 `RECLAIM_PROVIDER_ID` で設定するか、APIリクエスト時に指定

### 開発環境（ZKP_MOCK=true）
- **不要**: モックモードでは実際の検証を行わないため不要
- Provider IDがなくてもモックレスポンスを返す

## 実装での扱い

```typescript
// server/src/reclaim.ts
export async function createProofRequest(params: {
  providerId?: string  // オプショナル
  context?: Record<string, any>
}): Promise<ProofRequestResult> {
  const providerId = params.providerId || process.env.RECLAIM_PROVIDER_ID

  if (!providerId || isZkpMock()) {
    // Provider IDがない、またはモックモードの場合
    // モックレスポンスを返す
    return mockResponse
  }

  // 本番モード: Provider IDを使って実際の検証リクエストを作成
  const request = await reclaimClient.requestProofs(providerId, {...})
}
```

## Provider IDの例

- **Uber アカウント検証**: `f3a4394b-191a-4889-9f5c-e0d70dc26fac`
- **Kaggle アカウント検証**: `c94476a0-8a75-4563-b70a-bf6124d7c59b`
- **カスタムプロバイダー**: Reclaim Developer Portalで作成可能

## 取得方法

1. [Reclaim Developer Portal](https://dev.reclaimprotocol.org/)にアクセス
2. アプリを作成
3. プロバイダーを追加（既存のものを選択 or カスタム作成）
4. Provider IDをコピー

## Steam検証の場合

Steam専用のエンドポイント（`/zkp/steam/proof`）では、Provider IDは不要：
- zkFetchを直接使用してSteamのデータを取得
- カスタムロジックで検証を実装

## まとめ

- **Provider ID = 検証するサービスの指定**
- **本番では必須、開発（モック）では不要**
- **環境変数またはAPIパラメータで指定**
- **Steamなど特定のサービスは専用実装も可能**