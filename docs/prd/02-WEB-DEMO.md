# PRD 02: Web Demo Specifications

## Document Info
- **Component**: partner-enablement-demo
- **Type**: Next.js Web Application
- **Framework**: Next.js 14 (App Router)
- **Hosting**: Vercel
- **Status**: In Development

---

## Overview

The web demo provides a frictionless way for non-technical stakeholders (hiring managers, practice leaders) to experience the value of the MCP server without installing anything. It simulates the MCP workflow with pre-generated content.

---

## Architecture

```
web-demo/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Main demo page
│   │   ├── globals.css         # Global styles + Tailwind
│   │   └── api/                # API routes (future)
│   ├── components/             # Reusable components (future)
│   └── lib/                    # Utilities (future)
├── public/                     # Static assets
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── next.config.js
```

---

## User Flow

```
┌─────────────────┐
│  Landing Page   │
│                 │
│  Select Industry│
│  [Healthcare]   │──────┐
│  [Financial*]   │      │
└─────────────────┘      │
        * disabled       │
                         ▼
┌─────────────────────────────────────┐
│  Project Context View               │
│                                     │
│  Shows: Jira project simulation     │
│  - Project name & description       │
│  - Recent issues with labels        │
│                                     │
│  [Run Full Demo] [Generate Context] │
└─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────┐
│  Step 1: Project Context            │
│  ┌─────────────────────────────┐   │
│  │ Generated markdown output    │   │
│  │ with detected compliance     │   │
│  │ and integration targets      │   │
│  └─────────────────────────────┘   │
│                      [Next Step] ───┼──┐
└─────────────────────────────────────┘  │
                                         │
┌─────────────────────────────────────┐  │
│  Step 2: Reference Architecture     │◄─┘
│  ┌─────────────────────────────┐   │
│  │ Architecture pattern         │   │
│  │ Mermaid diagram             │   │
│  │ Components & services        │   │
│  └─────────────────────────────┘   │
│                      [Next Step] ───┼──┐
└─────────────────────────────────────┘  │
                                         │
┌─────────────────────────────────────┐  │
│  Step 3: Compliance Assessment      │◄─┘
│  ┌─────────────────────────────┐   │
│  │ Applicable frameworks        │   │
│  │ Key requirements             │   │
│  │ Risk areas & checklist       │   │
│  └─────────────────────────────┘   │
│                      [Next Step] ───┼──┐
└─────────────────────────────────────┘  │
                                         │
┌─────────────────────────────────────┐  │
│  Step 4: Implementation Plan        │◄─┘
│  ┌─────────────────────────────┐   │
│  │ Timeline & phases            │   │
│  │ Sprint structure             │   │
│  │ Jira ticket templates        │   │
│  └─────────────────────────────┘   │
│                   [Complete Demo] ──┼──┐
└─────────────────────────────────────┘  │
                                         │
┌─────────────────────────────────────┐  │
│  Completion State                   │◄─┘
│                                     │
│  ✓ Demo Complete!                   │
│                                     │
│  Summary of what was demonstrated   │
│                                     │
│  [Try Another] [View on GitHub]     │
│                                     │
│  About the Author section           │
└─────────────────────────────────────┘
```

---

## Components

### Header
- Logo/icon with gradient background
- Project title: "Partner Enablement Demo"
- Subtitle: "GSI Architecture Generator powered by Claude"
- GitHub and LinkedIn links

### Progress Steps
- Horizontal stepper showing: Context → Architecture → Compliance → Plan
- Active step highlighted in amber
- Completed steps show checkmark in green
- Visible only after industry selection

### Industry Selection Cards
- Two cards: Healthcare (enabled), Financial Services (disabled)
- Healthcare card shows: HIPAA, Epic EHR, FHIR badges
- Financial card shows: SOC2, PCI-DSS badges with "Coming soon"
- Hover effect with shadow lift

### Project Context View
- Simulated Jira project header
- List of issues with:
  - Issue key (e.g., HEALTH-1)
  - Summary
  - Priority badge (color-coded)
  - Labels
  - Description preview
- Action buttons: "Run Full Demo" and "Generate Context"

### Generated Content Display
- Header with step icon and title
- Loading indicator during "generation"
- Markdown content in monospace font
- Scrollable with max-height
- Next Step button in footer

### Completion State
- Success icon (green checkmark)
- Summary text explaining what was demonstrated
- Three feature cards (Context, Architecture, Planning)
- Call-to-action buttons
- About the Author section with links

---

## State Management

```typescript
interface DemoState {
  selectedIndustry: 'healthcare' | 'financial' | null;
  currentStep: 'select' | 'context' | 'architecture' | 'compliance' | 'plan' | 'complete';
  isGenerating: boolean;
  streamingText: string;
  generatedContent: {
    context?: string;
    architecture?: string;
    compliance?: string;
    plan?: string;
  };
}
```

### State Transitions

```
select ──[select industry]──> context (pre-generation view)
context ──[generate context]──> context (with content)
context ──[next step]──> architecture (triggers generation)
architecture ──[next step]──> compliance (triggers generation)
compliance ──[next step]──> plan (triggers generation)
plan ──[complete demo]──> complete
complete ──[try another]──> select (reset all state)
```

---

## Simulated Content

### Healthcare Project Data

```typescript
const healthcareProject = {
  key: 'HEALTH',
  name: 'Healthcare AI Assistant',
  description: 'AI-powered patient intake and benefits navigation system for regional health network',
  issues: [
    {
      key: 'HEALTH-1',
      summary: 'Patient Intake Conversational Flow',
      description: 'Design and implement conversational AI flow...',
      labels: ['hipaa', 'phi', 'patient-facing', 'epic-integration'],
      type: 'Epic',
      priority: 'High'
    },
    // ... more issues
  ]
};
```

### Generated Content

Pre-written markdown strings that simulate Claude's output:
- **Context**: Project summary, compliance indicators, integration targets
- **Architecture**: Pattern selection, components, Mermaid diagram
- **Compliance**: HIPAA requirements, risk areas, checklist
- **Plan**: Phases, sprints, Jira tickets

### Streaming Simulation

```typescript
const simulateGeneration = async (step: Step) => {
  setIsGenerating(true);
  const content = getContentForStep(step);
  
  // Simulate character-by-character streaming
  for (let i = 0; i < content.length; i += 3) {
    await new Promise(resolve => setTimeout(resolve, 10));
    setStreamingText(content.substring(0, i + 3));
  }
  
  setGeneratedContent(prev => ({ ...prev, [step]: content }));
  setIsGenerating(false);
};
```

---

## Styling

### Color Palette

```javascript
// tailwind.config.js
colors: {
  anthropic: {
    50: '#fdf8f6',
    // ... warm tan palette
    900: '#43302b',
  },
  claude: {
    orange: '#D97706',  // Amber-600
    tan: '#D4A574',
  }
}
```

### Typography

```css
font-family: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Menlo', 'monospace'],
}
```

### Key Styles

| Element | Style |
|---------|-------|
| Cards | `bg-white rounded-xl border border-gray-200 shadow-sm` |
| Primary Button | `bg-gray-900 text-white rounded-lg hover:bg-gray-800` |
| Secondary Button | `bg-amber-600 text-white rounded-lg hover:bg-amber-700` |
| Progress Active | `bg-amber-100 text-amber-800` |
| Progress Complete | `bg-green-100 text-green-800` |
| Priority Critical | `bg-red-100 text-red-700` |
| Priority High | `bg-orange-100 text-orange-700` |
| Labels | `bg-gray-200 text-gray-600 text-xs rounded px-2 py-0.5` |

---

## Responsive Design

### Breakpoints

| Screen | Layout |
|--------|--------|
| Mobile (<640px) | Single column, stacked cards |
| Tablet (640-1024px) | Two column grid for cards |
| Desktop (>1024px) | Full layout with sidebar potential |

### Mobile Considerations
- Progress steps scroll horizontally
- Issue cards stack vertically
- Generated content has smaller font
- Buttons full-width on mobile

---

## Accessibility

- Semantic HTML (header, main, section, article)
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast meets WCAG AA
- Focus indicators on buttons
- Alt text on icons (via Lucide)

---

## Performance

### Targets
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Total Blocking Time: <200ms
- Cumulative Layout Shift: <0.1

### Optimizations
- Next.js automatic code splitting
- Inter font via next/font
- No external API calls in demo mode
- Minimal JavaScript bundle
- Static generation where possible

---

## SEO & Meta

```typescript
export const metadata: Metadata = {
  title: 'Partner Enablement Demo | GSI Architecture Generator',
  description: 'Demonstrate how Claude can help GSIs generate compliant reference architectures from project requirements',
  authors: [{ name: 'Ed Gaile' }],
  openGraph: {
    title: 'Partner Enablement Demo',
    description: 'GSI Architecture Generator powered by Claude',
    type: 'website',
  },
};
```

---

## Future Enhancements

### Phase 2
- [ ] Real Claude API integration (optional)
- [ ] Mermaid diagram rendering
- [ ] Export to PDF/Markdown
- [ ] Copy to clipboard buttons

### Phase 3
- [ ] Financial Services vertical
- [ ] Custom project input form
- [ ] Save/share demo state
- [ ] Analytics integration

---

## Build & Deploy

### Development

```bash
cd web-demo
npm install
npm run dev
# Open http://localhost:3000
```

### Production Build

```bash
npm run build
npm run start
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy

# Production deploy
vercel deploy --prod
```

### Environment Variables (Optional)

```bash
# For future Claude API integration
ANTHROPIC_API_KEY=sk-ant-...
```

---

## File-by-File Implementation Checklist

### src/app/layout.tsx
- [ ] Import Inter font via next/font
- [ ] Set up metadata (title, description, author)
- [ ] Create root layout with gradient background
- [ ] Apply font class to body

### src/app/globals.css
- [ ] Tailwind directives (@tailwind base, components, utilities)
- [ ] CSS custom properties for colors
- [ ] Custom scrollbar styles
- [ ] Code block styles
- [ ] Animation keyframes for streaming

### src/app/page.tsx
- [ ] Define state interfaces
- [ ] Implement mock project data
- [ ] Create industry selection view
- [ ] Create project context view
- [ ] Create generated content display
- [ ] Create completion state
- [ ] Implement streaming simulation
- [ ] Add progress stepper
- [ ] Style all components with Tailwind

### tailwind.config.js
- [ ] Configure content paths
- [ ] Extend color palette
- [ ] Add custom fonts
- [ ] Configure any plugins

### package.json
- [ ] Add all dependencies
- [ ] Configure scripts (dev, build, start, lint)
- [ ] Set correct versions
