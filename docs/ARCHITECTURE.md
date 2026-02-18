# Architecture Documentation

## System Overview

The Partner Enablement MCP Server is designed to demonstrate how Anthropic's partner team could help GSIs operationalize Claude deployments. It consists of three main components working together to provide a complete demonstration experience.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTION LAYER                                 │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐    │
│  │    Web Demo       │  │   Video Demo      │  │   GitHub Repository   │    │
│  │   (Vercel/Next)   │  │    (Loom)         │  │   (Source + Docs)     │    │
│  │                   │  │                   │  │                       │    │
│  │ • Simulates MCP   │  │ • Shows real MCP  │  │ • Full source code    │    │
│  │ • No setup needed │  │ • Technical depth │  │ • Setup instructions  │    │
│  │ • Shareable URL   │  │ • Personal touch  │  │ • Knowledge base      │    │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MCP SERVER CORE                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Tool Registry                                │    │
│  │                                                                      │    │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │    │
│  │  │ partner_read_      │  │ partner_generate_  │                     │    │
│  │  │ project_context    │  │ reference_         │                     │    │
│  │  │                    │  │ architecture       │                     │    │
│  │  │ Reads Jira project │  │ Creates arch docs  │                     │    │
│  │  │ and issue context  │  │ with diagrams      │                     │    │
│  │  └────────────────────┘  └────────────────────┘                     │    │
│  │                                                                      │    │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │    │
│  │  │ partner_assess_    │  │ partner_create_    │                     │    │
│  │  │ compliance         │  │ implementation_    │                     │    │
│  │  │                    │  │ plan               │                     │    │
│  │  │ HIPAA, SOC2, etc.  │  │ Sprints + tickets  │                     │    │
│  │  │ analysis           │  │                    │                     │    │
│  │  └────────────────────┘  └────────────────────┘                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Service Layer                                 │    │
│  │                                                                      │    │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │    │
│  │  │    Jira Client     │  │   Knowledge Base   │                     │    │
│  │  │                    │  │                    │                     │    │
│  │  │ • Real Jira API    │  │ • Architectures    │                     │    │
│  │  │ • Mock fallback    │  │ • Compliance rules │                     │    │
│  │  │                    │  │ • Industry data    │                     │    │
│  │  └────────────────────┘  └────────────────────┘                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KNOWLEDGE LAYER                                     │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐    │
│  │ architectures.json│  │  compliance.json  │  │   industries.json     │    │
│  │                   │  │                   │  │                       │    │
│  │ • RAG patterns    │  │ • HIPAA rules     │  │ • Healthcare uses     │    │
│  │ • Agent patterns  │  │ • SOC2 controls   │  │ • FinServ uses        │    │
│  │ • Batch patterns  │  │ • FedRAMP reqs    │  │ • Integration specs   │    │
│  │ • HITL patterns   │  │ • Checklists      │  │ • Stakeholder maps    │    │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Tool: partner_read_project_context

```
┌─────────┐    ┌──────────┐    ┌────────────┐    ┌──────────────┐
│  Input  │───▶│  Jira    │───▶│  Extract   │───▶│   Output     │
│projectKey│    │  Client  │    │  Context   │    │  Markdown/   │
│         │    │          │    │            │    │  JSON        │
└─────────┘    └──────────┘    └────────────┘    └──────────────┘
                    │
                    ▼
              ┌──────────┐
              │  Mock    │ (fallback when
              │  Client  │  Jira not configured)
              └──────────┘
```

### Tool: partner_generate_reference_architecture

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────┐
│  Project    │───▶│  Pattern     │───▶│  Component     │───▶│ Output   │
│  Context    │    │  Matcher     │    │  Builder       │    │          │
└─────────────┘    └──────────────┘    └────────────────┘    └──────────┘
                          │                    │
                          ▼                    ▼
                   ┌──────────────┐    ┌──────────────┐
                   │ Knowledge    │    │ Compliance   │
                   │ Base         │    │ Data         │
                   │ (patterns)   │    │              │
                   └──────────────┘    └──────────────┘
```

## Technology Stack

### MCP Server
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 18+ | Server execution |
| Language | TypeScript | Type safety |
| MCP SDK | @modelcontextprotocol/sdk | MCP protocol implementation |
| Validation | Zod | Input schema validation |
| HTTP Client | Axios | Jira API communication |
| HTTP Server | Express | HTTP transport option |

### Web Demo
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 | React framework |
| Styling | Tailwind CSS | Utility-first CSS |
| Icons | Lucide React | Icon library |
| Hosting | Vercel | Deployment platform |

## Transport Options

The MCP server supports two transport mechanisms:

### stdio (Default)
- Used for local development and Claude Desktop integration
- Simple subprocess communication
- No network configuration required

```bash
TRANSPORT=stdio npm start
```

### HTTP
- Used for remote access and multi-client scenarios
- Exposes `/mcp` endpoint for MCP protocol
- Includes `/health` endpoint for monitoring

```bash
TRANSPORT=http PORT=3000 npm start
```

## Security Considerations

### Jira API
- API tokens stored in environment variables
- Basic authentication over HTTPS
- Token never logged or exposed

### MCP Protocol
- Tool annotations indicate read-only operations
- No destructive operations in current toolset
- Input validation on all parameters

### Knowledge Base
- Static JSON files, no external dependencies
- No sensitive data in knowledge content
- Compliance guidance is informational only

## Extension Points

### Adding New Tools

1. Create Zod schema in `src/schemas/index.ts`
2. Implement tool handler in `src/index.ts`
3. Register with `server.registerTool()`

### Adding Industry Verticals

1. Add industry data to `src/knowledge/industries.json`
2. Add relevant compliance rules to `src/knowledge/compliance.json`
3. Add architecture patterns if needed to `src/knowledge/architectures.json`

### Adding Integrations

The `JiraClient` pattern can be replicated for other tools:
- Confluence for documentation
- Azure DevOps for Microsoft shops
- GitHub for code-centric workflows

## Performance Considerations

### Knowledge Base Loading
- JSON files loaded lazily on first access
- Cached in memory after initial load
- Small footprint (~50KB total)

### Jira API
- Single API call per tool invocation
- Rate limiting handled by Jira Cloud
- Mock client enables offline demos

### Web Demo
- Static generation where possible
- Client-side state management
- No server-side API calls in demo mode

## Deployment

### MCP Server

```bash
# Build
cd mcp-server
npm install
npm run build

# Run (stdio)
npm start

# Run (HTTP)
TRANSPORT=http PORT=3000 npm start
```

### Web Demo

```bash
# Development
cd web-demo
npm install
npm run dev

# Production (Vercel)
vercel deploy
```

### Environment Variables

```bash
# Jira Configuration (optional - uses mock if not set)
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Server Configuration
PORT=3000
TRANSPORT=stdio  # or 'http'
```
