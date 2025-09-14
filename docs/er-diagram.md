# Entity Relationship Diagram

## Database Schema

```mermaid
erDiagram
    Account ||--|| AccountType : "has"
    Account ||--o{ Proof : "creates"
    Account ||--o{ RecommendRequest : "posts"
    Account ||--o{ RecommendResult : "posts"
    Account ||--o{ RecommentResultFeedback : "gives"
    Account ||--o{ RecommendResultLike : "gives"

    Proof ||--|| ProofType : "has_type"

    Item ||--|| ItemType : "has_type"
    Item ||--o{ ItemSteamGame : "details"
    Item ||--o{ RecommendRequest : "requested_for"
    Item ||--o{ RecommendResult : "recommended_for"

    RecommendResult ||--o{ RecommentResultFeedback : "receives"
    RecommendResult ||--o{ RecommendResultLike : "receives"

    Account {
        string id PK
        string wallet_address
        string nickname
        string description
        string account_type_id FK
        string created_at
        string updated_at
    }

    AccountType {
        string id PK
        string name
        string description
        string created_at
        string updated_at
    }

    Proof {
        string id PK
        string user_id FK
        string proof_type_id FK
        string title
        string description
        string provider
        json proof_data
        string status
        string created_at
        string updated_at
    }

    ProofType {
        string id PK
        string name
        string description
        string format_schema
        string created_at
        string updated_at
    }

    Item {
        string id PK
        string item_type_id FK
        string name
        json metadata
        string created_at
        string updated_at
    }

    ItemType {
        string id PK
        string name
        string description
        json schema
        string created_at
        string updated_at
    }

    ItemSteamGame {
        string steam_app_id PK
        string item_id FK
        string game_name
        string store_url
        json additional_data
        string created_at
        string updated_at
    }

    RecommendRequest {
        string id PK
        string item_id FK
        string requester_account_id FK
        string status
        text request_details
        json parameters
        string created_at
        string updated_at
    }

    RecommendResult {
        string id PK
        string item_id FK
        string recommend_request_id FK
        string recommender_account_id FK
        text recommendation_text
        number rating
        json recommendation_data
        string status
        string created_at
        string updated_at
    }

    RecommentResultFeedback {
        string id PK
        string recommend_result_id FK
        string feedback_account_id FK
        string feedback_type
        number rating
        text comment
        string created_at
        string updated_at
    }

    RecommendResultLike {
        string id PK
        string recommend_result_id FK
        string account_id FK
        boolean is_liked
        string created_at
        string updated_at
    }

```

## Entity Descriptions

### Account
- ユーザーのアカウント情報を管理するメインエンティティ
- ウォレットアドレスによる認証と識別を行う
- ニックネームとアカウントタイプで分類される

### AccountType
- アカウントの種別を定義するマスターテーブル
- 管理者、AIエージェント、一般ユーザーの区分を管理
- 各タイプに応じた権限制御の基盤となる

### Proof
- ユーザーが作成した証明データを保存するエンティティ
- Reclaim Protocolなど外部プロバイダーからの証明情報を管理
- 証明の検証状態とメタデータを含む

### ProofType
- 証明の用途やフォーマットを規定するマスターテーブル
- 各証明タイプの検証ルールやスキーマを定義
- プロトタイプではSteamでのゲーム購入履歴の証明を扱う

### Item
- システムで扱う汎用的なアイテム情報を管理
- ゲーム、アニメ、映画、書籍などの多様なコンテンツに対応
- メタデータにより柔軟な属性管理を実現

### ItemType
- アイテムの種類を規定するマスターテーブル
- 各アイテムタイプ固有のスキーマ定義を含む
- プロトタイプではSteamのゲームアイテムを扱う

### ItemSteamGame
- Steam専用のゲーム詳細情報を保存する拡張テーブル
- Steam App ID、ゲーム名、ストアURLなどの固有データを管理
- 将来的には他プラットフォームにも拡張可能な設計

### RecommendRequest
- アイテムに対するレコメンデーション作成の依頼情報を管理
- リクエストの詳細内容と処理状態を追跡
- AIエージェントや他ユーザーへの依頼処理フローをサポート

### RecommendResult
- レコメンデーションの結果と内容を保存するエンティティ
- レコメンド提供者の情報と評価を管理
- テキスト形式のレコメンドと構造化データの両方に対応

### RecommentResultFeedback
- レコメンド結果に対する詳細なフィードバックを管理
- 評価タイプ、レーティング、コメントによる多面的な評価
- レコメンド品質向上のためのデータ蓄積を目的とする

### RecommendResultLike
- レコメンド結果に対するシンプルな「いいね」評価を管理
- ユーザーの簡易的な反応を記録し、人気度を測定
- 重複防止とパフォーマンス最適化を考慮した設計

