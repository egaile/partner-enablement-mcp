/**
 * CloudOAuthProviderFactory — adapts the cloud's `ServerOAuthProvider`
 * (DB-backed token persistence + the SDK's PKCE flow) to the
 * `OAuthProviderFactory` port used by gateway-core's ConnectionManager.
 *
 * Static auth-header servers return null here and fall through to the
 * connection manager's static-headers code path.
 */

import type {
  OAuthProviderFactory,
} from "@mcpshield/gateway-core/proxy";
import type { McpServerRecord } from "@mcpshield/gateway-core/storage";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { ServerOAuthProvider } from "../auth/server-oauth-provider.js";

export class CloudOAuthProviderFactory implements OAuthProviderFactory {
  forServer(server: McpServerRecord): OAuthClientProvider | null {
    if (server.authType !== "oauth2") return null;
    return new ServerOAuthProvider(server);
  }
}
