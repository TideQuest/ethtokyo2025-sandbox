# VSR: Verifiable Social Recommendation - ETHTokyo 2025 Sandbox

VSR is a verifiable social recommendation system using zero-knowledge proofs with Steam purchase history. Users can prove their game purchase history in a privacy-preserving manner and build a community-driven, decentralized recommendation system.

## Local Development Setup

### Prerequisites

- Docker & Docker Compose
- VS Code (for Dev Container usage)

### Method 1: Running with Docker Compose

1. **Clone the repository**
   ```bash
   git clone https://github.com/TideQuest/ethtokyo2025-sandbox.git
   cd ethtokyo2025-sandbox
   ```

2. **Configure environment variables**
   - Ensure `.env` file exists
   - **Required settings**: Get the following values from https://dev.reclaimprotocol.org/
     ```bash
     RECLAIM_APP_ID=your_app_id_here
     RECLAIM_APP_SECRET=your_app_secret_here
     ZKP_MOCK=false  # Use actual Reclaim authentication
     ```
   - Other settings work with default values

3. **Start services**
   ```bash
   # Start database and Ollama
   docker-compose up -d db ollama
   
   # Initialize Ollama model (first time only, takes a few minutes)
   docker-compose --profile init up ollama-init
   
   # Start backend and frontend
   docker-compose up -d backend frontend
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - PostgreSQL: localhost:5432
   - Ollama: http://localhost:11434

5. **Stop services**
   ```bash
   docker-compose down
   ```

### Method 2: Development with Dev Container

1. **Open with VS Code**
   ```bash
   code .
   ```

2. **Reopen in Dev Container**
   - Select "Reopen in Container" in VS Code
   - Or use Command Palette (Ctrl+Shift+P) → "Dev Containers: Reopen in Container"

3. **Start development server**
   ```bash
   # Inside the backend container
   pnpm dev
   ```

4. **Start frontend separately**
   ```bash
   # In another terminal
   docker-compose up -d frontend
   ```

### Troubleshooting

- **Reclaim Protocol configuration error**: Ensure `RECLAIM_APP_ID` and `RECLAIM_APP_SECRET` are correctly set
  - Create an app at https://dev.reclaimprotocol.org/ and get credentials
  - For development/testing, set `ZKP_MOCK=true` to skip actual Reclaim authentication (use `false` for production)
- **Slow Ollama model download**: llama3.2:1b is about 1GB in size. Initial download takes a few minutes.
- **Port already in use**: Stop services with `docker-compose down` and retry
- **Database connection error**: Wait for database to start before starting the backend

### Development Commands

```bash
# Check logs
docker-compose logs <service-name>

# Restart specific service
docker-compose restart <service-name>

# Reset database
docker-compose down -v
docker-compose up -d db
```

## Project Structure

- `client/`: React + TypeScript frontend
- `server/`: Node.js + Express + Prisma backend
- `chrome-extension-*/`: Chrome extensions for Steam purchase history extraction
- `.devcontainer/`: VS Code Dev Container configuration
- `docker-compose.yml`: Docker Compose configuration
