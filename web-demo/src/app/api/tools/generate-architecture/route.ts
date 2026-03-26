import { NextResponse } from 'next/server';
import { GenerateArchitectureInputSchema } from 'partner-enablement-mcp-server/schemas';
import { knowledgeBase, ROVO_SERVER_NAME } from '../_shared';
import { callTool, isConfigured } from '@/lib/gateway-client';
import { rateLimit } from '../_rateLimit';

interface ConfluenceContextPage {
  title: string;
  excerpt: string;
  spaceKey?: string;
  url?: string;
  lastModified?: string;
}

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

/**
 * Search Confluence for architecture docs and read the top match.
 */
async function fetchConfluenceContext(cloudId: string): Promise<ConfluenceContextPage[]> {
  const pages: ConfluenceContextPage[] = [];

  try {
    // Search for architecture docs via CQL
    const searchResult = await callTool(rovo('searchConfluenceUsingCql'), {
      cloudId,
      cql: 'type = page AND (text ~ "architecture" OR text ~ "reference architecture" OR text ~ "deployment")',
      limit: 3,
    });

    if (searchResult.isError) return pages;

    const searchText = extractText(searchResult);
    const searchData = JSON.parse(searchText);
    const results = searchData?.results ?? searchData ?? [];

    if (!Array.isArray(results) || results.length === 0) return pages;

    for (const result of results.slice(0, 2)) {
      const pageId = result.content?.id ?? result.id;
      const title = result.content?.title ?? result.title ?? 'Untitled';
      const excerpt = result.excerpt ?? result.content?.excerpt ?? '';
      const spaceKey = result.content?.space?.key ?? result.resultGlobalContainer?.title ?? '';

      // Build the page context from search result
      const page: ConfluenceContextPage = {
        title,
        excerpt: excerpt.replace(/<\/?[^>]+(>|$)/g, '').substring(0, 300), // Strip HTML
        spaceKey,
        url: result.content?._links?.webui
          ? `${result._links?.base ?? ''}${result.content._links.webui}`
          : result.url,
      };

      // Try to read the full page for a richer excerpt
      if (pageId) {
        try {
          const pageResult = await callTool(rovo('getConfluencePage'), {
            cloudId,
            pageId: String(pageId),
            contentFormat: 'markdown',
          });
          if (!pageResult.isError) {
            const pageText = extractText(pageResult);
            const pageData = JSON.parse(pageText);
            if (pageData.body?.storage?.value || pageData.body?.view?.value) {
              const content = (pageData.body?.storage?.value ?? pageData.body?.view?.value ?? '')
                .replace(/<\/?[^>]+(>|$)/g, '')
                .substring(0, 400);
              if (content) page.excerpt = content;
            }
          }
        } catch {
          // Use search excerpt if page read fails
        }
      }

      pages.push(page);
    }
  } catch (err) {
    console.warn('[generate-architecture] Confluence search failed:', err instanceof Error ? err.message : err);
  }

  return pages;
}

/**
 * Mock Confluence context for when gateway is unavailable.
 */
function getMockConfluenceContext(projectKey: string): ConfluenceContextPage[] {
  if (projectKey === 'HEALTH' || projectKey.toLowerCase().includes('health')) {
    return [
      {
        title: 'Healthcare AI Reference Architecture',
        excerpt: 'HIPAA-compliant architecture with component diagram, data flow, encryption at rest/transit, FHIR integration patterns. Includes deployment topology for AWS with dedicated VPC isolation for PHI workloads.',
        spaceKey: 'HAI',
      },
      {
        title: 'PHI Data Classification Guide',
        excerpt: 'Data classification tiers for healthcare AI workloads. Tier 1: Direct identifiers (SSN, MRN). Tier 2: Quasi-identifiers (DOB, ZIP). Tier 3: Clinical data (diagnoses, medications). AI/ML pipeline considerations for each tier.',
        spaceKey: 'HAI',
      },
    ];
  }
  return [
    {
      title: 'Financial Services AI Architecture',
      excerpt: 'Loan processing pipeline with document extraction, PCI-DSS tokenization layer, SOC2 monitoring integration. Multi-tenant architecture with data isolation per customer segment.',
      spaceKey: 'FSAI',
    },
    {
      title: 'PCI-DSS Compliance Runbook',
      excerpt: 'Tokenization procedures for cardholder data in AI pipelines. Key management via AWS KMS with automatic rotation. Network segmentation requirements for AI workloads processing payment data.',
      spaceKey: 'FSAI',
    },
  ];
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = GenerateArchitectureInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { projectContext, includeAlternatives, includeDiagram, focusAreas } = parsed.data;

    // Recommend pattern based on use case
    const recommendedPatternId = knowledgeBase.recommendPattern(
      projectContext.useCaseDescription,
      projectContext.complianceTags || []
    );

    const pattern = knowledgeBase.getArchitecturePattern(recommendedPatternId);
    if (!pattern) {
      return NextResponse.json(
        { error: `Pattern '${recommendedPatternId}' not found` },
        { status: 500 }
      );
    }

    // Get cloud-specific services
    const cloudProvider = projectContext.cloudProvider || 'aws';
    const components = Object.entries(pattern.components).map(([key, comp]) => ({
      name: key,
      description: comp.description,
      services: {
        [cloudProvider]:
          comp.services[cloudProvider as keyof typeof comp.services] || [],
        anthropic: comp.services.anthropic || [],
      },
      considerations: [] as string[],
    }));

    // Add compliance-specific considerations
    const complianceFrameworks: string[] = projectContext.complianceTags || [];
    for (const framework of complianceFrameworks) {
      const frameworkData = knowledgeBase.getComplianceFramework(framework);
      if (frameworkData) {
        for (const comp of components) {
          const implications =
            frameworkData.architectureImplications[comp.name];
          if (implications && 'implementation' in implications) {
            comp.considerations.push(...implications.implementation);
          }
        }
      }
    }

    // Phase 6.5: Sort components to prioritize focusAreas
    const areas = focusAreas || [];
    if (areas.length > 0) {
      const focusLower = areas.map(f => f.toLowerCase());
      components.sort((a, b) => {
        const aMatch = focusLower.some(f => a.name.toLowerCase().includes(f) || a.description.toLowerCase().includes(f));
        const bMatch = focusLower.some(f => b.name.toLowerCase().includes(f) || b.description.toLowerCase().includes(f));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    // Phase 6.4: Only append ellipsis when description exceeds 100 chars
    const desc = projectContext.useCaseDescription;
    const truncatedDesc = desc.length > 100 ? `${desc.substring(0, 100)}...` : desc;
    let rationaleStr = `Based on the use case "${truncatedDesc}", the ${pattern.name} pattern is recommended because it supports ${pattern.useCases[0]?.toLowerCase() || 'your requirements'}.`;
    if (areas.length > 0) {
      rationaleStr += ` Focus areas: ${areas.join(', ')}.`;
    }

    // Fetch Confluence context for architecture docs
    let confluenceContext: ConfluenceContextPage[] = [];
    if (isConfigured()) {
      try {
        // Get cloudId first
        const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
        if (!resourcesResult.isError) {
          const resourcesText = extractText(resourcesResult);
          const resources = JSON.parse(resourcesText);
          const cloudId: string = Array.isArray(resources) ? resources[0]?.id : resources?.id;
          if (cloudId) {
            confluenceContext = await fetchConfluenceContext(cloudId);
          }
        }
      } catch (err) {
        console.warn('[generate-architecture] Confluence context failed, using mock:', err instanceof Error ? err.message : err);
        confluenceContext = getMockConfluenceContext(projectContext.projectKey);
      }
    } else {
      confluenceContext = getMockConfluenceContext(projectContext.projectKey);
    }

    const output = {
      pattern: recommendedPatternId,
      patternName: pattern.name,
      rationale: rationaleStr,
      components,
      dataFlow: pattern.dataFlow,
      mermaidDiagram: includeDiagram ? pattern.mermaidDiagram : undefined,
      securityConsiderations: [
        ...pattern.securityConsiderations,
        ...(complianceFrameworks.includes('hipaa')
          ? [
              'BAA required with Claude API provider',
              'PHI must be encrypted at rest and in transit',
              'Comprehensive audit logging required for all PHI access',
            ]
          : []),
      ],
      scalingConsiderations: pattern.scalingConsiderations || [],
      alternatives: includeAlternatives
        ? Object.entries(knowledgeBase.getAllPatterns())
            .filter(([id]) => id !== recommendedPatternId)
            .slice(0, 2)
            .map(([id, p]) => ({
              pattern: id,
              rationale: `Consider if ${p.useCases[0]}`,
            }))
        : undefined,
      confluenceContext,
    };

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
