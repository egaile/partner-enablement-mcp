# PRD 00: Project Overview

## Document Info
- **Project**: Partner Enablement MCP Server
- **Author**: Ed Gaile
- **Last Updated**: 2024-02
- **Status**: In Development

---

## Executive Summary

### What We're Building
An MCP (Model Context Protocol) server that demonstrates how Anthropic's partner team could help Global System Integrators (GSIs) accelerate Claude deployments by automatically generating compliant reference architectures from project requirements.

### Why We're Building It
This project serves as a portfolio piece for an Anthropic Partner Solutions Architect application. It demonstrates:
1. Technical proficiency with MCP and Claude integration
2. Understanding of GSI partner workflows and challenges
3. Deep domain expertise in healthcare compliance (HIPAA)
4. Ability to create tools that help partners succeed

### Success Criteria
1. **Functional**: MCP server runs in Claude Desktop and all 4 tools work correctly
2. **Demonstrable**: Web demo provides frictionless experience for non-technical viewers
3. **Professional**: Code quality, documentation, and presentation are production-grade
4. **Shareable**: Can be distributed via GitHub link, web URL, and video

---

## Problem Statement

### GSI Pain Points
When Global System Integrators land enterprise customers wanting to deploy Claude, they face recurring challenges:

1. **Architecture Selection**: Which pattern fits this use case? (RAG, Agent, Batch, HITL)
2. **Compliance Mapping**: What are the HIPAA/SOC2/FedRAMP implications?
3. **Integration Design**: How do we connect to Epic EHR, Salesforce, etc.?
4. **Project Planning**: What's a realistic timeline and team structure?

### Current State
This knowledge lives in the heads of experienced architects. Each engagement starts from scratch, leading to:
- Inconsistent solution quality
- Longer sales cycles
- Repeated mistakes on compliance
- Difficulty scaling partner teams

### Desired State
Claude-powered tooling that codifies best practices, enabling:
- Consistent, high-quality architecture recommendations
- Automated compliance assessment
- Repeatable deployment patterns
- Faster partner onboarding

---

## Solution Overview

### Core Concept
An MCP server that Claude can use to:
1. **Read** project context from enterprise tools (Jira)
2. **Generate** appropriate reference architectures
3. **Assess** compliance requirements
4. **Create** implementation plans

### Three Distribution Paths

| Path | Audience | Purpose |
|------|----------|---------|
| **MCP Server** | Technical reviewers | Demonstrate real MCP implementation |
| **Web Demo** | Hiring managers, non-technical | Frictionless demo experience |
| **Video (Loom)** | Anyone | Personal touch, walkthrough |

---

## User Personas

### Primary: Anthropic Hiring Team
- **Goal**: Evaluate candidate's technical skills and strategic thinking
- **Needs**: Easy access to demo, clear evidence of capability
- **Context**: Reviewing multiple candidates, limited time

### Secondary: GSI Partner Architect
- **Goal**: Accelerate Claude deployments for customers
- **Needs**: Reliable architecture guidance, compliance clarity
- **Context**: Working on healthcare AI project with tight timeline

### Tertiary: GSI Practice Leader
- **Goal**: Scale AI practice, win more deals
- **Needs**: Repeatable methodologies, training materials
- **Context**: Building team capabilities

---

## Scope

### In Scope (MVP)

#### MCP Server
- [ ] 4 tools: read context, generate architecture, assess compliance, create plan
- [ ] Jira Cloud integration with mock fallback
- [ ] Healthcare vertical with HIPAA compliance
- [ ] AWS cloud service mappings
- [ ] stdio and HTTP transport options

#### Web Demo
- [ ] Industry selection (Healthcare primary)
- [ ] Simulated Jira project display
- [ ] Step-by-step generation flow
- [ ] Markdown output rendering
- [ ] Completion state with call-to-action

#### Documentation
- [ ] README with setup instructions
- [ ] Architecture documentation
- [ ] Video script
- [ ] PRD documents (this)

### Out of Scope (Future)
- Financial Services vertical (content exists but not primary)
- Real-time Claude API integration in web demo
- Jira ticket creation (read-only for MVP)
- Confluence integration
- Multi-cloud support (GCP, Azure)
- User authentication
- Persistent storage

---

## Technical Requirements

### MCP Server

| Requirement | Specification |
|-------------|---------------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict mode) |
| MCP SDK | @modelcontextprotocol/sdk ^1.0.0 |
| Validation | Zod schemas for all inputs |
| Transport | stdio (default), HTTP (optional) |
| Output Formats | JSON and Markdown |

### Web Demo

| Requirement | Specification |
|-------------|---------------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Hosting | Vercel |
| State | React useState (no external state) |

### Knowledge Base

| Requirement | Specification |
|-------------|---------------|
| Format | Static JSON files |
| Architecture Patterns | 4 patterns minimum |
| Compliance Frameworks | HIPAA (detailed), SOC2, FedRAMP |
| Industry Verticals | Healthcare (primary), Financial Services (secondary) |

---

## Milestones

### Week 1: Foundation
- [ ] Project structure created
- [ ] MCP server builds and runs
- [ ] All 4 tools implemented
- [ ] Mock Jira data working
- [ ] MCP Inspector testing passes

### Week 2: Polish
- [ ] Web demo complete and deployed
- [ ] Real Jira integration tested (optional)
- [ ] Documentation finalized
- [ ] Code review and cleanup

### Week 3: Distribution
- [ ] Loom video recorded
- [ ] GitHub repository public
- [ ] LinkedIn post drafted
- [ ] Application submitted with links

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP SDK breaking changes | Low | High | Pin SDK version, test frequently |
| Jira API rate limits | Medium | Low | Mock data fallback |
| Demo complexity overwhelming | Medium | Medium | Clear step-by-step flow |
| Technical depth not visible | Medium | High | Video walkthrough, architecture docs |

---

## Success Metrics

### Quantitative
- MCP server responds in <2 seconds per tool call
- Web demo loads in <3 seconds
- Video is 4-5 minutes (attention span optimal)
- Zero errors in demo flow

### Qualitative
- Code is clean, well-documented, production-quality
- Demo tells a coherent story about partner enablement
- Technical depth is evident without being overwhelming
- Personal brand and expertise come through

---

## Appendix

### Related Documents
- [01-MCP-SERVER.md](./01-MCP-SERVER.md) - MCP server specifications
- [02-WEB-DEMO.md](./02-WEB-DEMO.md) - Web demo specifications
- [03-KNOWLEDGE-BASE.md](./03-KNOWLEDGE-BASE.md) - Knowledge content specs
- [04-DEPLOYMENT.md](./04-DEPLOYMENT.md) - Deployment guide

### References
- [MCP Specification](https://modelcontextprotocol.io)
- [Anthropic Job Posting](https://www.anthropic.com/careers)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
