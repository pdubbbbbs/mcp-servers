import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/mcp/*', cors({
  origin: ['https://app.warp.dev', 'https://*.warp.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

interface Env {
  FIGMA_TOKEN: string;
}

const MCP_TOOLS = [
  {
    name: 'get_file',
    description: 'Get Figma file details',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'list_components',
    description: 'List components in a Figma file',
    inputSchema: {
      type: 'object', 
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'export_assets',
    description: 'Export assets from Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'Node IDs to export' },
        format: { type: 'string', enum: ['png', 'jpg', 'svg', 'pdf'], description: 'Export format' }
      },
      required: ['fileId', 'nodeIds']
    }
  }
];

app.post('/mcp', async (c) => {
  try {
    const env = c.env as Env;
    const request = await c.req.json();
    
    switch (request.method) {
      case 'tools/list':
        return c.json({ jsonrpc: '2.0', id: request.id, result: { tools: MCP_TOOLS } });
        
      case 'initialize':
        return c.json({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'Figma MCP Server',
              version: '1.0.0',
              description: 'Figma integration for Warp AI Terminal via MCP'
            }
          }
        });
        
      case 'tools/call':
        const { name, arguments: args } = request.params;
        
        // Implement Figma API calls here
        let result = { message: `${name} tool called with args: ${JSON.stringify(args)}` };
        
        return c.json({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        });
        
      default:
        return c.json({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` }
        });
    }
  } catch (error) {
    return c.json({
      jsonrpc: '2.0',
      id: 0,
      error: { code: -32700, message: 'Parse error' }
    });
  }
});

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));
app.get('/', (c) => c.json({
  name: 'Figma MCP Server',
  version: '1.0.0',
  description: 'Figma integration for Warp AI Terminal via MCP',
  author: 'Philip S Wright'
}));

export default app;
