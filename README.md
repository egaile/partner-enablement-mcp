# Partner Enablement MCP Server

A demonstration project showing how Anthropic's partner team could help GSIs operationalize Claude deployments in enterprise environments.

## Project Overview

This project consists of three components:

1. **MCP Server** (`/mcp-server`) - A Model Context Protocol server that connects Claude to Jira workflows and generates compliant reference architectures
2. **Web Demo** (`/web-demo`) - A Next.js application that demonstrates the MCP tools with real service outputs
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
+---------------------------------------------------------+
|                     DEMO LAYER                          |
|  +--------------+  +--------------+  +----------------+ |
|  |   Web App   |  |  Video Demo  |  | GitHub + Docs  | |
|  |  (Vercel)   |  |   (Loom)     |  |  (Technical)   | |
|  +--------------+  +--------------+  +----------------+ |
+---------------------------------------------------------+
                            |
+---------------------------------------------------------+
|                   MCP SERVER CORE                       |
|  +---------------------------------------------------+ |
|  |  Tools (all inline in index.ts):                   | |
|  |  - partner_read_project_context                    | |
|  |  - partner_generate_reference_architecture         | |
|  |  - partner_assess_compliance                       | |
|  |  - partner_create_implementation_plan              | |
|  +---------------------------------------------------+ |
+---------------------------------------------------------+
                            |
+---------------------------------------------------------+
|                 KNOWLEDGE LAYER                         |
|  +----------------+  +----------------+  +------------+ |
|  | Architecture   |  |  Compliance    |  |  Industry  | |
|  |   Patterns     |  |   Frameworks   |  |  Templates | |
|  +----------------+  +----------------+  +------------+ |
+---------------------------------------------------------+
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm

### Install (monorepo)

```bash
npm install          # installs all workspaces from root
```

### MCP Server

```bash
cd mcp-server
npm run build
npm start            # stdio mode (default)
TRANSPORT=http npm start  # HTTP mode on PORT (default 3000)
```

### Web Demo

```bash
cd web-demo
npm run dev          # Next.js dev server on port 3000
```

### Claude Desktop Configuration

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "partner-enablement": {
      "command": "node",
      "args": ["/path/to/partner-enablement-mcp/mcp-server/dist/index.js"],
      "env": {
        "JIRA_HOST": "your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
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

### Financial Services (Coming Soon)
- SOC2 compliance patterns
- PCI considerations for payment data
- Data residency requirements

## Environment Variables

```bash
# Jira Cloud Configuration (optional - falls back to mock data)
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Server Configuration
PORT=3000
TRANSPORT=stdio  # or 'http' for remote access
```

## Project Structure

```
partner-enablement-mcp/
+-- package.json             # npm workspaces root
+-- mcp-server/
|   +-- src/
|   |   +-- index.ts         # MCP server entry point (all 4 tools inline)
|   |   +-- services/
|   |   |   +-- jiraClient.ts
|   |   |   +-- knowledgeBase.ts
|   |   +-- schemas/
|   |   |   +-- index.ts
|   |   +-- knowledge/
|   |       +-- architectures.json
|   |       +-- compliance.json
|   |       +-- industries.json
|   +-- package.json
|   +-- tsconfig.json
+-- web-demo/
|   +-- src/app/
|   |   +-- page.tsx          # Main demo page
|   |   +-- api/tools/        # API routes calling real services
|   |   +-- layout.tsx
|   |   +-- globals.css
|   +-- package.json
|   +-- next.config.js
+-- docs/
    +-- VIDEO_SCRIPT.md
    +-- ARCHITECTURE.md
```

## Demo Workflow

1. **Select Industry Vertical** - Choose Healthcare (Financial Services coming soon)
2. **View Sample Project** - See a realistic Jira project with requirements
3. **Generate Architecture** - Watch the system generate a reference architecture
4. **Review Outputs** - Architecture diagram, compliance checklist, implementation plan

## Author

Ed Gaile - Principal Solutions Architect
- LinkedIn: linkedin.com/in/edgaile
- GitHub: github.com/egaile

## License

MIT
