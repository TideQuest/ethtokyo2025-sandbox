# System Architecture

## High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        WEB[Web Application<br/>React/Next.js]
        EXT[Chrome Extension<br/>JavaScript]
    end

    subgraph "API Layer"
        API[API Server<br/>Node.js/Express]
    end

    subgraph "Business Logic Layer"
        PROOF[Proof Service]
        VERIFY[Verification Service]
        USER[User Service]
    end

    subgraph "Data Layer"
        DB[(Database<br/>PostgreSQL)]
    end

    subgraph "External Services"
        RECLAIM[Reclaim Protocol]
        BLOCKCHAIN[Blockchain<br/>Networks]
    end

    WEB --> API
    EXT --> API
    API --> PROOF
    API --> VERIFY
    API --> USER

    PROOF --> DB
    VERIFY --> DB
    USER --> DB

    VERIFY --> RECLAIM
    PROOF --> BLOCKCHAIN

    classDef frontend fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef business fill:#e8f5e8
    classDef data fill:#fff3e0
    classDef external fill:#fce4ec

    class WEB,EXT frontend
    class API,AUTH api
    class PROOF,VERIFY,USER business
    class DB,CACHE data
    class RECLAIM,BLOCKCHAIN,IPFS external
```

## Component Details

### Frontend Layer

#### Web Application
- **Technology**: React/Next.js
- **Purpose**: Main user interface for proof creation and management
- **Features**:
  - Wallet connection
  - Proof dashboard
  - Verification status tracking

#### Chrome Extension
- **Technology**: JavaScript/HTML/CSS
- **Purpose**: Browser integration for seamless proof collection
- **Features**:
  - One-click proof generation
  - Website data extraction
  - Background script processing

### API Layer

#### API Server
- **Technology**: Node.js/Next.js
- **Purpose**: Central API gateway
- **Responsibilities**:
  - Request routing
  - Response formatting
  - Middleware processing
  - Rate limiting

#### Authentication
- **Technology**: Wallet signatures
- **Purpose**: User authentication and authorization
- **Features**:
  - Wallet-based login
  - Session management
  - Permission control

### Business Logic Layer

#### Proof Service
- **Purpose**: Core proof management
- **Responsibilities**:
  - Proof creation
  - Data validation
  - Status tracking
  - Metadata management

#### Verification Service
- **Purpose**: Proof verification logic
- **Responsibilities**:
  - Reclaim Protocol integration
  - Verification result processing

#### User Service
- **Purpose**: User account management
- **Responsibilities**:
  - User registration
  - Profile management
  - Preferences handling

#### Recommendation Service
- **Purpose**: Recommend dataset management
- **Responsibilities**:
  - Recommend request
  - Recommend result

#### AI Agent Service
- **Purpose**: 
- **Responsibilities**:

### Data Layer

#### Database (PostgreSQL)
- **Purpose**: Primary data storage
- **Contents**:
  - User accounts
  - Proof records
  - Verification results
  - Session data

### External Services

#### Reclaim Protocol
- **Purpose**: Zero-knowledge proof generation
- **Integration**: API calls for proof verification

#### Blockchain Networks
- **Purpose**: Decentralized verification and storage
- **Supported**: Ethereum, Polygon, etc.

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant V as Verification
    participant R as Reclaim
    participant D as Database

    U->>F: Create Proof Request
    F->>A: POST /proofs
    A->>V: Process Proof Data
    V->>R: Submit for Verification
    R-->>V: Verification Result
    V->>D: Store Result
    D-->>A: Confirmation
    A-->>F: Response
    F-->>U: Updated Status
```

## Security Considerations

### Authentication
- Wallet-based authentication
- JWT token management
- Session expiration handling

### Data Protection
- Encrypted sensitive data
- Secure API endpoints
- Input validation and sanitization

### External Integrations
- Secure communication with Reclaim Protocol
- Blockchain interaction security
- IPFS content verification

## Scalability

### Horizontal Scaling
- Load balancer for API servers
- Database read replicas
- Microservice architecture preparation

### Performance Optimization
- Redis caching strategy
- Database query optimization
- CDN for static assets

### Monitoring
- Application performance monitoring
- Error tracking and logging
- Health check endpoints