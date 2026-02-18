# Partner Enablement MCP Server - Demo Video Script

**Duration:** 4-5 minutes  
**Format:** Loom screen recording with voiceover  
**Audience:** Anthropic hiring team, technical reviewers

---

## Opening (30 seconds)

**[Screen: Title slide or GitHub README]**

"Hi, I'm Ed Gaile. I built this project to demonstrate how Anthropic's partner team could help Global System Integrators operationalize Claude deployments faster.

The core idea is simple: GSIs building Claude solutions face the same challenges over and over—translating requirements into compliant architectures, understanding regulatory implications, creating repeatable deployment patterns. What if Claude could help with that workflow directly?"

---

## Problem Statement (30 seconds)

**[Screen: Simple diagram or bullet points]**

"When a GSI lands a healthcare customer who wants to build a patient intake assistant, they need to figure out:
- What architecture pattern fits the use case?
- What are the HIPAA implications?
- How do I integrate with Epic EHR?
- What does a realistic project plan look like?

Currently, this knowledge lives in the heads of experienced architects. This MCP server makes it accessible through Claude."

---

## MCP Server Demo (2 minutes)

**[Screen: Claude Desktop with MCP server connected]**

"Let me show you how it works. I have the Partner Enablement MCP server running locally, connected to Claude Desktop.

**[Type: "Read the context from my HEALTH project in Jira"]**

Claude calls the `partner_read_project_context` tool, which connects to Jira and extracts:
- Project metadata and description
- Recent issues with requirements
- Labels that indicate compliance needs—see it detected HIPAA and PHI tags
- Integration targets like Epic EHR

**[Show output, pause briefly]**

Now let's generate an architecture.

**[Type: "Based on this context, generate a reference architecture for AWS"]**

Claude analyzes the requirements and recommends the Conversational Agent pattern because:
- The use case involves multi-turn patient interactions
- It needs tool use for EHR integration
- Real-time responses are required

Notice it's not just picking a pattern—it's mapping specific AWS services, adding HIPAA-specific security considerations, and generating a Mermaid diagram.

**[Show architecture output]**

**[Type: "Assess compliance requirements for this project"]**

Here's where domain expertise really matters. The compliance assessment identifies:
- HIPAA as required, with specific implementation requirements
- Risk areas like PHI in prompts and conversation logging
- An actionable implementation checklist

**[Type: "Create an implementation plan with Jira tickets"]**

And finally, we get a phased project plan with sprint structure and Jira ticket templates that could be imported directly into the project."

---

## Web Demo (45 seconds)

**[Screen: Switch to web application]**

"For stakeholders who won't install MCP servers, I built this web demo that simulates the same experience.

**[Click through Healthcare → Run Full Demo]**

You can see the same workflow—context extraction, architecture generation, compliance assessment, implementation planning—but in a format that's easy to share. Send someone a link, they can experience the value in 30 seconds.

**[Show completed state]**"

---

## Why This Matters (45 seconds)

**[Screen: Back to you or simple slide]**

"This project demonstrates a few things I think matter for the Partner Solutions Architect role:

First, **I understand the GSI workflow**. I've lived this—helping partners translate customer requirements into technical delivery plans is literally my current job at Appfire.

Second, **I'm tracking Anthropic's technical direction**. MCP is a bet on how Claude connects to the real world. Building something that makes MCP enterprise-ready shows I'm thinking about where this is going.

Third, **I can ship**. This isn't a slide deck or a concept—it's working code with documentation, demo paths, and production-quality output.

The full source is on GitHub. I'd love to discuss how this thinking could apply to Anthropic's partner enablement strategy.

Thanks for watching."

---

## Technical Notes for Recording

1. **Before recording:**
   - Have Claude Desktop open with MCP server connected
   - Have web demo running locally or deployed
   - Have Jira mock data visible (or real Jira if configured)
   - Test all commands work smoothly

2. **During recording:**
   - Speak slowly and clearly
   - Pause briefly after each tool call to let output render
   - Use mouse to highlight key parts of output
   - Keep energy level conversational, not salesy

3. **After recording:**
   - Trim any awkward pauses
   - Add chapter markers for easy navigation
   - Include GitHub link in description

---

## Call to Action in Description

```
Partner Enablement MCP Server Demo

Demonstrates how Claude can help GSIs accelerate enterprise AI deployments by generating compliant reference architectures from project requirements.

📁 GitHub: https://github.com/egaile/partner-enablement-mcp
🌐 Web Demo: [Vercel URL]
💼 LinkedIn: https://linkedin.com/in/edgaile

Built as part of my application for Partner Solutions Architect at Anthropic.

Chapters:
0:00 - Introduction
0:30 - Problem Statement
1:00 - MCP Server Demo
3:00 - Web Demo
3:45 - Why This Matters
```
