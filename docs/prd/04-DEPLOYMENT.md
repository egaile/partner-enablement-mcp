# PRD 04: Deployment & Distribution

## Document Info
- **Component**: Deployment Strategy
- **Platforms**: GitHub, Vercel, Claude Desktop, Loom
- **Status**: In Development

---

## Overview

This document covers how to build, deploy, and distribute the Partner Enablement MCP Server across all channels to maximize visibility and impact.

---

## Distribution Channels

```
┌─────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION MATRIX                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│     Channel     │    Audience     │       Purpose           │
├─────────────────┼─────────────────┼─────────────────────────┤
│ GitHub Repo     │ Technical       │ Source code, docs,      │
│                 │ reviewers       │ credibility             │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Web Demo        │ Hiring mgrs,    │ Frictionless demo,      │
│ (Vercel)        │ non-technical   │ shareable link          │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Loom Video      │ Anyone          │ Personal touch,         │
│                 │                 │ walkthrough             │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Claude Desktop  │ Technical       │ Real MCP demo,          │
│                 │ deep-dive       │ hands-on testing        │
├─────────────────┼─────────────────┼─────────────────────────┤
│ LinkedIn Post   │ Network,        │ Visibility,             │
│                 │ Anthropic team  │ engagement              │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## MCP Server Deployment

### Local Development

```bash
# Clone and setup
git clone https://github.com/egaile/partner-enablement-mcp.git
cd partner-enablement-mcp/mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

### Claude Desktop Integration

#### Configuration File Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Configuration Content

```json
{
  "mcpServers": {
    "partner-enablement": {
      "command": "node",
      "args": ["/absolute/path/to/partner-enablement-mcp/mcp-server/dist/index.js"],
      "env": {
        "JIRA_HOST": "your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

#### Without Jira (Mock Data)

```json
{
  "mcpServers": {
    "partner-enablement": {
      "command": "node",
      "args": ["/absolute/path/to/partner-enablement-mcp/mcp-server/dist/index.js"]
    }
  }
}
```

### Verification Steps

1. Restart Claude Desktop after config change
2. Open new conversation
3. Click the tools icon (hammer) to see available tools
4. Verify 4 tools appear:
   - partner_read_project_context
   - partner_generate_reference_architecture
   - partner_assess_compliance
   - partner_create_implementation_plan
5. Test: "Read the context from my HEALTH project"

---

## Web Demo Deployment

### Vercel Setup

#### Prerequisites
- Vercel account (free tier sufficient)
- GitHub repository connected

#### Deployment Steps

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to web-demo
cd web-demo

# Login to Vercel
vercel login

# Deploy (preview)
vercel

# Deploy (production)
vercel --prod
```

#### Environment Variables (Optional)

If adding Claude API integration later:
```bash
vercel env add ANTHROPIC_API_KEY
```

### Custom Domain (Optional)

1. Go to Vercel dashboard
2. Select project
3. Go to Settings → Domains
4. Add custom domain (e.g., partner-demo.edgaile.com)

### Deployment Checklist

- [ ] `npm run build` succeeds locally
- [ ] Preview deployment works
- [ ] Production deployment works
- [ ] Mobile responsive
- [ ] All links work (GitHub, LinkedIn)
- [ ] Demo flow completes without errors

---

## GitHub Repository Setup

### Repository Structure

```
partner-enablement-mcp/
├── .gitignore
├── LICENSE (MIT)
├── README.md
├── CLAUDE.md
├── docs/
│   ├── prd/
│   ├── ARCHITECTURE.md
│   └── VIDEO_SCRIPT.md
├── mcp-server/
└── web-demo/
```

### .gitignore

```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Vercel
.vercel/

# Debug logs
npm-debug.log*
```

### README.md Sections

1. **Header**: Project name, one-line description
2. **Demo Links**: Web demo, video, GitHub
3. **What This Does**: Problem statement, solution
4. **Quick Start**: MCP server, web demo
5. **Architecture**: High-level diagram
6. **MCP Tools**: Table of tools
7. **Screenshots**: Web demo flow
8. **Author**: Bio, links
9. **License**: MIT

### Repository Settings

- [ ] Public repository
- [ ] Description: "MCP server demonstrating GSI partner enablement for Claude deployments"
- [ ] Topics: `mcp`, `anthropic`, `claude`, `healthcare`, `hipaa`, `architecture`
- [ ] Website: Vercel demo URL
- [ ] License: MIT

---

## Loom Video Recording

### Pre-Recording Checklist

- [ ] Claude Desktop open with MCP server connected
- [ ] Web demo running (localhost or Vercel)
- [ ] Jira configured or mock data confirmed
- [ ] Screen resolution appropriate (1920x1080 recommended)
- [ ] Notifications disabled
- [ ] Clean desktop/browser

### Recording Setup

- **Tool**: Loom (free tier)
- **Format**: Screen + camera (picture-in-picture)
- **Resolution**: 1080p
- **Duration**: 4-5 minutes

### Video Structure

| Section | Duration | Content |
|---------|----------|---------|
| Intro | 0:30 | Who you are, what you built |
| Problem | 0:30 | GSI challenges |
| MCP Demo | 2:00 | Live tool usage in Claude Desktop |
| Web Demo | 0:45 | Quick walkthrough |
| Close | 0:45 | Why this matters, call to action |

### Post-Recording

1. Trim any awkward pauses
2. Add chapter markers:
   - 0:00 Introduction
   - 0:30 Problem Statement
   - 1:00 MCP Server Demo
   - 3:00 Web Demo
   - 3:45 Why This Matters
3. Add description with links
4. Generate shareable link

---

## LinkedIn Post Strategy

### Post Content

```
🚀 I built something to demonstrate how AI can accelerate enterprise deployments.

The Partner Enablement MCP Server shows how Claude can help GSIs translate project requirements into compliant reference architectures—automatically.

Here's what it does:
📋 Reads project context from Jira
🏗️ Generates appropriate architecture patterns
🔒 Assesses compliance requirements (HIPAA, SOC2)
📊 Creates implementation plans with sprint structure

The meta-point: using Claude to build tools that help partners deploy Claude faster.

🎥 Watch the demo: [Loom link]
🌐 Try it yourself: [Vercel link]
💻 Source code: [GitHub link]

Built this as part of exploring opportunities at Anthropic. The Partner Solutions Architect role is exactly where I want to apply 25 years of enterprise architecture experience to the AI space.

#AI #Claude #Anthropic #MCP #HealthcareIT #EnterpriseArchitecture
```

### Engagement Strategy

- Post during business hours (10am-2pm)
- Tag relevant Anthropic folks (carefully)
- Respond to all comments quickly
- Share in relevant groups

---

## Application Integration

### Application Materials

Include in application:
1. **Resume**: Updated with AI/LLM focus
2. **Cover Letter**: Reference this project specifically
3. **Links**:
   - GitHub repository
   - Web demo (Vercel)
   - Video walkthrough (Loom)

### Cover Letter Integration

```
I've built a working prototype to demonstrate my thinking: the Partner 
Enablement MCP Server (github.com/egaile/partner-enablement-mcp). 

This MCP server shows how Claude can help GSIs translate project requirements 
into compliant reference architectures—essentially using Claude to build tools 
that help partners deploy Claude faster.

You can see a 4-minute walkthrough at [Loom link] or try the web demo at 
[Vercel link].
```

### Internal Referral Communication

```
Hi [Referral Name],

I've completed that project I mentioned—here's a quick summary:

📋 Partner Enablement MCP Server
- MCP server with 4 tools for GSI enablement
- Generates compliant architectures from Jira requirements
- Healthcare focus with HIPAA expertise

Links:
- Demo video (4 min): [Loom]
- Web demo: [Vercel]
- Source: [GitHub]

Would love your feedback before I submit formally. Any suggestions for who 
else at Anthropic might be interested in seeing this?

Thanks!
Ed
```

---

## Deployment Checklist

### Phase 1: Development Complete
- [ ] MCP server builds without errors
- [ ] All 4 tools work in MCP Inspector
- [ ] Web demo runs locally
- [ ] All documentation written

### Phase 2: Deployment
- [ ] GitHub repository public
- [ ] Vercel deployment live
- [ ] Claude Desktop config tested
- [ ] All links verified

### Phase 3: Distribution
- [ ] Loom video recorded and edited
- [ ] LinkedIn post drafted
- [ ] Application materials updated
- [ ] Internal referral notified

### Phase 4: Submit
- [ ] Application submitted with all links
- [ ] LinkedIn post published
- [ ] Monitor for questions/feedback

---

## Troubleshooting

### MCP Server Not Appearing in Claude Desktop

1. Check config file location is correct
2. Verify JSON syntax is valid
3. Ensure absolute path to dist/index.js
4. Restart Claude Desktop completely
5. Check Console for errors

### Web Demo Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Vercel Deployment Fails

1. Check build logs in Vercel dashboard
2. Verify package.json scripts
3. Ensure all dependencies are in package.json
4. Check for environment variable issues

### Video Quality Issues

1. Record at 1080p minimum
2. Use wired internet if possible
3. Close bandwidth-heavy applications
4. Test audio levels before recording

---

## Success Metrics

### Technical
- [ ] MCP server responds in <2s per tool
- [ ] Web demo loads in <3s
- [ ] Zero errors in demo flow
- [ ] Video is 4-5 minutes

### Distribution
- [ ] GitHub repo accessible
- [ ] Web demo shareable
- [ ] Video watchable
- [ ] LinkedIn post published

### Engagement
- [ ] Application submitted
- [ ] Referral utilized
- [ ] Feedback received
- [ ] Interview scheduled (goal!)
