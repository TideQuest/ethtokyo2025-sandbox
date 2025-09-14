# ngrokでのホスティング手順（ZK Steam Proto）

このドキュメントは、ZK Steam Protoアプリケーションをngrokを使用して公開する手順を説明します。ハッカソンのデモやテスト環境として最適化されています。

## 前提条件
- DockerとDocker Composeがインストール済み
- Gitがインストール済み
- ngrokアカウント（無料プランで十分、Personal/Pro/Businessプランでカスタムサブドメイン可）
- Node.js（v18以上）とpnpmがインストール済み

## ngrokプラン比較

### 無料プラン（Free）
- ランダムURL（例：`https://abc123-def456.ngrok-free.app`）
- 1つの静的ドメインを無料で取得可能（2024年以降）
- セッション毎にURLが変わる可能性あり（再起動時）
- 1分あたり40接続まで
- HTTPSサポート

### Personal プラン（$8/月、年額払い時）
- **1つのカスタムサブドメイン**（例：`myapp.ngrok.app` または `myapp.ngrok.dev`）
- URLが固定され、再起動してもサブドメインが維持される
- 1つの予約TCPアドレス
- 月5GBのデータ転送量
- 個人の非商用プロジェクトに最適
- ハッカソンのデモに推奨

### Pro/Business プラン
- 複数のカスタムドメイン
- ワイルドカードドメイン対応
- チーム機能
- より高いデータ転送量制限

## アーキテクチャ概要
このプロジェクトは以下のサービスで構成されています：
- **Frontend**: Viteベースのクライアント（ポート5173）
- **Backend**: Node.jsサーバー（ポート3000）
- **Database**: PostgreSQL 16（ポート5432）
- **Ollama**: LLMサービス（ポート11434）
- **Nginx**: リバースプロキシ（ポート8080、オプション）

## セットアップ手順

### 1. リポジトリをクローン
```bash
git clone <repository-url>
cd <repository-name>
```

### 2. 環境変数の設定
`.env`ファイルを作成し、必要な環境変数を設定：
```bash
cp .env.example .env  # サンプルファイルがある場合
```

必要な環境変数：
```env
# PostgreSQL
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=zksteam_db

# Ollama
OLLAMA_MODEL=llama3  # または使用するモデル

# その他必要な設定
```

### 3. Docker Composeでサービスを起動

#### 基本起動（開発環境）
```bash
# 全サービスを起動
docker-compose up -d

# Ollamaモデルの初期化（初回のみ）
docker-compose --profile init up ollama-init
```

#### Nginxを含む起動（本番環境向け）
```bash
docker-compose --profile nginx up -d
```

### 4. ngrokのインストールと設定

#### Linux/Mac（Dev Containerでも同様）
```bash
# Homebrewを使用する場合（Mac）
brew install ngrok

# または公式インストーラー（Linux）
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

#### Windows
[ngrok公式サイト](https://ngrok.com/download)からダウンロード

#### 認証トークンの設定
[ngrokダッシュボード](https://dashboard.ngrok.com)でトークンを取得し設定：
```bash
ngrok config add-authtoken <your-authtoken>
```

### 5. ngrokでサービスを公開

#### 開発環境（個別サービス公開）

##### フロントエンドの公開
```bash
# 無料プラン（ランダムURL）
ngrok http 5173

# Personal プラン（固定サブドメイン）
ngrok http --subdomain=zksteam-frontend 5173
# または --domain オプションを使用
ngrok http --domain=zksteam-frontend.ngrok.app 5173
```

##### バックエンドAPIの公開
```bash
# 無料プラン
ngrok http 3000

# Personal プラン（固定サブドメイン）
ngrok http --subdomain=zksteam-api 3000
# または --domain オプションを使用
ngrok http --domain=zksteam-api.ngrok.app 3000
```

**注意**: Personal プランでは1つのサブドメインのみ使用可能なため、フロントエンドとバックエンドを同時に固定サブドメインで公開する場合は、Nginxを使用した統合公開を推奨

#### 本番環境（Nginx経由で統合公開）
```bash
# Nginxプロファイルでサービスを起動
docker-compose --profile nginx up -d

# 無料プラン
ngrok http 8080

# Personal プラン（固定サブドメインで統合公開 - 推奨）
ngrok http --subdomain=zksteam 8080
# または --domain オプションを使用
ngrok http --domain=zksteam.ngrok.app 8080
```

**Personal プランの利点**: 1つのサブドメインでフロントエンドとバックエンドの両方を提供できるため、コスト効率的

### 6. 複数エンドポイントの同時公開（ngrok設定ファイル使用）

`ngrok.yml`を作成：
```yaml
version: "2"
authtoken: <your-authtoken>
tunnels:
  frontend:
    addr: 5173
    proto: http
    # Personal プランの場合（どちらか1つのみ）
    # subdomain: zksteam-app
    # domain: zksteam-app.ngrok.app
  backend:
    addr: 3000
    proto: http
    # 無料プランまたは2つ目のトンネル
  nginx:
    addr: 8080
    proto: http
    # Personal プラン推奨（統合エンドポイント）
    # subdomain: zksteam
    # domain: zksteam.ngrok.app
```

起動：
```bash
ngrok start --all --config=ngrok.yml
```

## Dev Containerでの実行

VSCodeのDev Containerを使用する場合：

1. VSCodeでプロジェクトを開く
2. コマンドパレット（Cmd/Ctrl+Shift+P）で「Reopen in Container」を選択
3. コンテナ内でngrokをインストール：
```bash
# コンテナ内で実行
sudo apt update && sudo apt install -y curl
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install -y ngrok
```

4. ngrokを起動：
```bash
ngrok config add-authtoken <your-token>
ngrok http 3000  # バックエンドを公開
```

## 公開URLの確認とテスト

ngrok起動後、ターミナルに表示される情報を確認：
- **Forwarding**: 公開URL（例：`https://abc123.ngrok.io`）
- **Web Interface**: ngrok管理画面（`http://localhost:4040`）

### 動作確認
```bash
# フロントエンドアクセス
curl https://your-frontend-url.ngrok.io

# バックエンドAPIテスト
curl https://your-backend-url.ngrok.io/health

# WebSocketテスト（必要な場合）
wscat -c wss://your-backend-url.ngrok.io/ws
```

## セキュリティ設定

### 基本認証の追加（Pro/Businessプラン）
```bash
ngrok http --basic-auth="username:password" 5173
```

### IP制限（Pro/Businessプラン）
```bash
ngrok http --ip-policy-file=ip-policy.yml 5173
```

### Personal プランでのセキュリティ
Personal プランでは基本認証やIP制限は利用できませんが、以下の方法でセキュリティを強化できます：
- アプリケーション側で認証機能を実装
- 環境変数でアクセストークンを設定
- Nginxレベルでの基本認証設定

`ip-policy.yml`:
```yaml
rules:
  - action: allow
    cidr: 192.168.1.0/24
  - action: deny
    cidr: 0.0.0.0/0
```

### CORS設定
バックエンドでCORSを適切に設定し、ngrok URLを許可：
```javascript
// server/app.js または設定ファイル
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://*.ngrok.io',
    'https://*.ngrok.app'
  ]
};
```

## トラブルシューティング

### ngrok接続エラー
```bash
# 診断コマンド
ngrok diagnose

# ログ確認
ngrok logs
```

### ポート競合
```bash
# 使用中のポートを確認
lsof -i :5173  # Mac/Linux
netstat -ano | findstr :5173  # Windows
```

### Docker関連
```bash
# コンテナ状態確認
docker-compose ps

# ログ確認
docker-compose logs -f [service-name]

# 再起動
docker-compose restart [service-name]
```

### CORS/WebSocketエラー
- ngrok URLがバックエンドのCORS設定に含まれているか確認
- WebSocketの場合、`wss://`プロトコルを使用
- フロントエンドの環境変数を更新：
```bash
VITE_BACKEND_URL=https://your-backend.ngrok.io
```

## 終了手順

1. ngrokを停止：`Ctrl+C`
2. Dockerサービスを停止：
```bash
docker-compose down

# ボリュームも削除する場合
docker-compose down -v
```

## 推奨事項

### ハッカソンでのPersonal プラン活用
- **Personal プラン（$8/月）は短期間のハッカソンに最適**
- 固定URLによりQRコードやデモ資料の事前作成が可能
- 1つのサブドメインでNginx経由の統合公開を推奨
- デモ後は必要に応じてプランを無料に戻すことが可能

### パフォーマンス
- 本番デモではNginxプロファイルを使用して統合エンドポイントを提供
- 静的ファイルのキャッシュ設定を有効化
- Ollamaモデルは事前にpullしておく

### 監視
- ngrok Web Interface（`http://localhost:4040`）でリクエストを監視
- Docker logsで各サービスの状態を確認
- Health checkエンドポイントを定期的に確認

### デモ用設定
- 短時間のデモの場合、Ollamaのキープアライブを調整
- データベースの初期データを事前に投入
- フロントエンドのビルド済みファイルを使用（開発サーバーより高速）

## 参考リンク
- [ngrok公式ドキュメント](https://ngrok.com/docs)
- [Docker Compose リファレンス](https://docs.docker.com/compose/)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)