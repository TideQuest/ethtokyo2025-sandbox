# TideQuest API Documentation

このディレクトリには、TideQuest APIのSwagger UI形式のドキュメントが含まれています。

## セットアップ

1. 依存関係をインストール:
```bash
npm install
```

## 使用方法

### 1. OpenAPI仕様のリンティング
```bash
npm run lint
```

OpenAPI仕様の品質チェックとベストプラクティス確認

### 2. ドキュメントをビルド
```bash
npm run build
```

このコマンドは:
- `index.html` を `dist/` ディレクトリにコピー
- `openapi.yaml` を `dist/` ディレクトリにコピー

### 2. ローカルサーバーで提供
```bash
npm run serve
```

ブラウザで `http://localhost:3001` を開いてSwagger UIにアクセス

### 3. 開発モード（ビルド + サーブ）
```bash
npm run dev
```

### 4. ウォッチモード（変更を監視して自動リビルド）
```bash
npm run watch
```

## ファイル構成

- `openapi.yaml` - OpenAPI 3.0.3仕様書
- `index.html` - Swagger UIホストページ
- `build.js` - ビルドスクリプト
- `package.json` - npm設定とスクリプト
- `.spectral.yml` - OpenAPIリンティング設定
- `dist/` - ビルド出力ディレクトリ（自動生成）

## APIドキュメントの更新

`openapi.yaml` ファイルを編集後、以下のコマンドでドキュメントを更新:

```bash
npm run lint     # 仕様をリンティングしてエラーチェック
npm run build    # Swagger UIをビルド
npm run serve    # ローカルサーバーで提供
```

または開発モードで:

```bash
npm run watch    # 変更を監視して自動リビルド
```