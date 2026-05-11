// gateway uses Atlassian-aware exempt domains by default.
import { ExfiltrationStrategy as CoreExfiltrationStrategy } from "@mcpshield/gateway-core/security";

const ATLASSIAN_EXEMPT_DOMAINS: RegExp[] = [
  /\.atlassian\.net$/i,
  /\.atlassian\.com$/i,
  /\.atl-paas\.net$/i,
];

export class ExfiltrationStrategy extends CoreExfiltrationStrategy {
  constructor() {
    super({ exemptDomains: ATLASSIAN_EXEMPT_DOMAINS });
  }
}
