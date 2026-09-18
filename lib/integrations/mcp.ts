// A Model Context Protocol client.
//
// This is the piece that makes "connect Nessie to X" a config entry instead of
// a new integration each time. MCP servers expose their own tools, so anything
// that speaks MCP — Plaud, and whatever comes next — becomes reachable without
// writing a client for its particular API.
//
// Plain fetch over JSON-RPC 2.0, no SDK, in keeping with the rest of this
// codebase: fewer dependencies that can break on someone else's schedule.

export interface MCPServerConfig {
  name: string
  url: string
  /** Auth headers — bearer token, X-Api-Key, whatever the server wants. */
  headers?: Record<string, string>
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface RpcResponse {
  jsonrpc: string
  id?: number | string
  result?: Record<string, any>
  error?: { code: number; message: string; data?: unknown }
}

/**
 * Servers are configured as one JSON env var, so adding one is a settings
 * change rather than a code change:
 *
 *   MCP_SERVERS=[{"name":"plaud","url":"https://...","headers":{"Authorization":"Bearer ..."}}]
 */
export function configuredServers(): MCPServerConfig[] {
  const raw = process.env.MCP_SERVERS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is MCPServerConfig =>
        typeof s?.name === 'string' && typeof s?.url === 'string' && /^https?:\/\//i.test(s.url)
    )
  } catch {
    // A malformed value shouldn't take every server down silently, but there's
    // nowhere useful to report it from here — the tools surface it instead.
    return []
  }
}

export function findServer(name: string): MCPServerConfig | null {
  return configuredServers().find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? null
}

export class MCPClient {
  private id = 0
  private sessionId: string | null = null
  private initialized = false

  constructor(private config: MCPServerConfig) {}

  private async rpc(method: string, params?: Record<string, unknown>): Promise<Record<string, any>> {
    const res = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Streamable HTTP servers may reply with either, so accept both.
        Accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
        ...(this.config.headers ?? {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params: params ?? {} }),
    })

    // The server assigns a session on initialize and expects it echoed back.
    const session = res.headers.get('mcp-session-id')
    if (session) this.sessionId = session

    if (!res.ok) {
      throw new Error(`${this.config.name} ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }

    const body = await res.text()
    const parsed = parseRpcBody(body)
    if (parsed.error) {
      throw new Error(`${this.config.name}: ${parsed.error.message}`)
    }
    return parsed.result ?? {}
  }

  /** MCP requires initialize before anything else. Runs once per client. */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'nessie', version: '1.0.0' },
    })
    // Notification, not a request — failures here are not fatal.
    await this.rpc('notifications/initialized').catch(() => {})
    this.initialized = true
  }

  async listTools(): Promise<MCPTool[]> {
    await this.ensureInitialized()
    const result = await this.rpc('tools/list')
    const tools = Array.isArray(result.tools) ? result.tools : []
    return tools.map((t: Record<string, any>) => ({
      name: String(t.name),
      description: t.description ? String(t.description) : undefined,
      inputSchema: t.inputSchema,
    }))
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.ensureInitialized()
    const result = await this.rpc('tools/call', { name, arguments: args })

    // MCP returns content blocks; flatten the text ones, which is what a
    // language model can actually read.
    const content = Array.isArray(result.content) ? result.content : []
    const text = content
      .filter((c: Record<string, any>) => c?.type === 'text' && typeof c.text === 'string')
      .map((c: Record<string, any>) => c.text)
      .join('\n')

    if (result.isError) throw new Error(text || 'the tool reported an error')
    return text || result
  }
}

/**
 * Streamable HTTP servers may answer as JSON or as SSE. SSE frames carry the
 * JSON-RPC payload on `data:` lines, so unwrap those before parsing.
 */
function parseRpcBody(body: string): RpcResponse {
  const trimmed = body.trim()
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as RpcResponse

  for (const line of trimmed.split('\n')) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim()
      if (payload && payload !== '[DONE]') {
        try {
          return JSON.parse(payload) as RpcResponse
        } catch {
          // Keep looking; a stream can carry non-JSON keepalive frames.
        }
      }
    }
  }
  throw new Error('could not parse the response as JSON-RPC')
}
