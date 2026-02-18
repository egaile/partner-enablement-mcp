# Partner Enablement MCP Server

A demonstration project showing how Anthropic's partner team could help GSIs operationalize Claude deployments in enterprise environments.

## Project Overview

This project consists of three components:

1. **MCP Server** (`/mcp-server`) - A Model Context Protocol server that connects Claude to Jira workflows and generates compliant reference architectures
2. **Web Demo** (`/web-demo`) - A React application that simulates the MCP experience for non-technical stakeholders
3. **Documentation** (`/docs`) - Technical documentation and video script

## The Problem This Solves

Global System Integrators (GSIs) building Claude-based solutions face common challenges:
- Translating customer requirements into compliant AI architectures
- Understanding regulatory implications (HIPAA, SOC2, etc.)
- Creating repeatable deployment patterns
- Bridging the gap between project requirements and implementation plans

This MCP server demonstrates how Claude can assist with these workflows by:
- Reading project context from Jira
- Generating industry-specific reference architectures
- Assessing compliance requirements
- Creating implementation plans

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DEMO LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Web App    │  │  Video Demo  │  │  GitHub + Docs   │   │
│  │  (Vercel)    │  │   (Loom)     │  │  (Technical)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   MCP SERVER CORE                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Tools:                                              │    │
│  │  • partner_read_project_context                      │    │
│  │  • partner_generate_reference_architecture           │    │
│  │  • partner_assess_compliance                         │    │
│  │  • partner_create_implementation_plan                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                 KNOWLEDGE LAYER                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │
│  │ Architecture   │  │  Compliance    │  │   Industry   │   │
│  │   Patterns     │  │   Frameworks   │  │   Templates  │   │
│  └────────────────┘  └────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### MCP Server

```bash
cd mcp-server
npm install
npm run build
npm start
```

### Web Demo

```bash
cd web-demo
npm install
npm run dev
```

## MCP Tools

### `partner_read_project_context`
Connects to Jira Cloud API to extract project requirements, industry vertical, compliance tags, and technical specifications.

### `partner_generate_reference_architecture`
Takes project context and generates a compliant reference architecture including:
- Architecture pattern selection
- AWS/GCP service mappings
- Mermaid diagram code
- Security considerations

### `partner_assess_compliance`
Analyzes project context for regulatory implications:
- Applicable frameworks (HIPAA, SOC2, FedRAMP)
- Specific implementation requirements
- Risk areas and mitigations

### `partner_create_implementation_plan`
Generates a phased delivery approach:
- Sprint structure
- Key milestones
- Team skill requirements
- Jira ticket templates

## Industry Verticals

### Healthcare (Primary)
- HIPAA compliance patterns
- PHI handling architectures
- BAA considerations
- Audit logging requirements

### Financial Services (Secondary)
- SOC2 compliance patterns
- PCI considerations for payment data
- Data residency requirements

## Environment Variables

```bash
# Jira Cloud Configuration
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Claude API (for web demo)
ANTHROPIC_API_KEY=your-api-key

# Server Configuration
PORT=3000
TRANSPORT=stdio  # or 'http' for remote access
```

## Project Structure

```
partner-enablement-mcp/
├── mcp-server/
│   ├── src/
│   │   ├── index.ts              # MCP server entry point
│   │   ├── tools/                # Tool implementations
│   │   │   ├── readProjectContext.ts
│   │   │   ├── generateArchitecture.ts
│   │   │   ├── assessCompliance.ts
│   │   │   └── createImplementationPlan.ts
│   │   ├── services/             # External API clients
│   │   │   ├── jiraClient.ts
│   │   │   └── knowledgeBase.ts
│   │   ├── schemas/              # Zod validation schemas
│   │   │   └── index.ts
│   │   └── knowledge/            # Reference content
│   │       ├── architectures.json
│   │       ├── compliance.json
│   │       └── industries.json
│   ├── package.json
│   └── tsconfig.json
├── web-demo/
│   ├── src/
│   │   ├── app/                  # Next.js app router
│   │   ├── components/           # React components
│   │   └── lib/                  # Utilities
│   └── package.json
└── docs/
    ├── VIDEO_SCRIPT.md
    └── ARCHITECTURE.md
```

## Demo Workflow

1. **Select Industry Vertical** - Choose Healthcare, Financial Services, or Education
2. **View Sample Project** - See a realistic Jira project with requirements
3. **Generate Architecture** - Watch Claude reason through requirements
4. **Review Outputs** - Architecture diagram, compliance checklist, implementation plan
5. **Export** - Download artifacts or create Jira tickets

## Author

Ed Gaile - Principal Solutions Architect
- LinkedIn: linkedin.com/in/edgaile
- GitHub: github.com/egaile

## License

MIT
