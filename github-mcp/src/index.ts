import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GitHubClient } from './github';
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  ListRepositoriesRequest,
  CreateRepositoryRequest,
  ListIssuesRequest,
  CreateIssueRequest,
  CreatePullRequestRequest,
} from './types';

const app = new Hono();

// Enable CORS for all routes
app.use('/mcp/*', cors({
  origin: ['https://app.warp.dev', 'https://*.warp.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// Environment interface
interface Env {
  GITHUB_TOKEN: string;
  WEBHOOK_SECRET?: string;
}

// MCP Tools Definition
const MCP_TOOLS: MCPTool[] = [
  {
    name: 'list_repositories',
    description: 'List GitHub repositories for the authenticated user or a specific owner',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or organization)' },
        type: { type: 'string', enum: ['public', 'private', 'all'], description: 'Repository visibility' },
        sort: { type: 'string', enum: ['created', 'updated', 'pushed', 'full_name'], description: 'Sort repositories by' },
        direction: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
        per_page: { type: 'number', minimum: 1, maximum: 100, description: 'Number of results per page' },
        page: { type: 'number', minimum: 1, description: 'Page number' },
      },
    },
  },
  {
    name: 'get_repository',
    description: 'Get details of a specific repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'create_repository',
    description: 'Create a new repository',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Repository name' },
        description: { type: 'string', description: 'Repository description' },
        private: { type: 'boolean', description: 'Whether the repository is private' },
        has_issues: { type: 'boolean', description: 'Enable issues' },
        has_projects: { type: 'boolean', description: 'Enable projects' },
        has_wiki: { type: 'boolean', description: 'Enable wiki' },
        auto_init: { type: 'boolean', description: 'Initialize with README' },
        gitignore_template: { type: 'string', description: 'Gitignore template' },
        license_template: { type: 'string', description: 'License template' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_issues',
    description: 'List issues in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue state' },
        labels: { type: 'string', description: 'Comma-separated list of labels' },
        sort: { type: 'string', enum: ['created', 'updated', 'comments'], description: 'Sort issues by' },
        direction: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
        per_page: { type: 'number', minimum: 1, maximum: 100, description: 'Number of results per page' },
        page: { type: 'number', minimum: 1, description: 'Page number' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'create_issue',
    description: 'Create a new issue in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue description' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Usernames to assign' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List pull requests in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Pull request state' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create a new pull request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Pull request title' },
        body: { type: 'string', description: 'Pull request description' },
        head: { type: 'string', description: 'Branch to merge from' },
        base: { type: 'string', description: 'Branch to merge into' },
        draft: { type: 'boolean', description: 'Create as draft' },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
  },
  {
    name: 'search_repositories',
    description: 'Search for repositories',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        sort: { type: 'string', enum: ['stars', 'forks', 'help-wanted-issues', 'updated'], description: 'Sort by' },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_issues',
    description: 'Search for issues and pull requests',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        sort: { type: 'string', enum: ['comments', 'reactions', 'author-date', 'committer-date', 'updated'], description: 'Sort by' },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
      },
      required: ['query'],
    },
  },
];

// Helper function to create MCP error response
function createErrorResponse(id: string | number, code: number, message: string, data?: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

// Helper function to create MCP success response
function createSuccessResponse(id: string | number, result: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

// Main MCP endpoint
app.post('/mcp', async (c) => {
  try {
    const env = c.env as unknown as Env;
    const githubToken = env.GITHUB_TOKEN;

    if (!githubToken) {
      return c.json(createErrorResponse(0, -32000, 'GitHub token not configured'));
    }

    const request: MCPRequest = await c.req.json();
    const github = new GitHubClient(githubToken);

    // Handle MCP method calls
    switch (request.method) {
      case 'tools/list': {
        return c.json(createSuccessResponse(request.id, { tools: MCP_TOOLS }));
      }

      case 'tools/call': {
        const { name, arguments: args } = request.params;
        
        try {
          let result: any;

          switch (name) {
            case 'list_repositories':
              result = await github.listRepositories(args as ListRepositoriesRequest);
              break;

            case 'get_repository':
              result = await github.getRepository(args.owner, args.repo);
              break;

            case 'create_repository':
              result = await github.createRepository(args as CreateRepositoryRequest);
              break;

            case 'list_issues':
              result = await github.listIssues(args as ListIssuesRequest);
              break;

            case 'create_issue':
              result = await github.createIssue(args as CreateIssueRequest);
              break;

            case 'list_pull_requests':
              result = await github.listPullRequests(args.owner, args.repo, args.state);
              break;

            case 'create_pull_request':
              result = await github.createPullRequest(args as CreatePullRequestRequest);
              break;

            case 'search_repositories':
              result = await github.searchRepositories(args.query, args.sort, args.order);
              break;

            case 'search_issues':
              result = await github.searchIssues(args.query, args.sort, args.order);
              break;

            default:
              return c.json(createErrorResponse(request.id, -32601, `Unknown tool: ${name}`));
          }

          return c.json(createSuccessResponse(request.id, {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2),
            }],
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return c.json(createErrorResponse(request.id, -32000, `Tool execution failed: ${errorMessage}`));
        }
      }

      case 'initialize': {
        return c.json(createSuccessResponse(request.id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'GitHub MCP Server',
            version: '1.0.0',
            description: 'GitHub integration for Warp AI Terminal via MCP',
          },
        }));
      }

      default:
        return c.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    console.error('MCP server error:', error);
    return c.json(createErrorResponse(0, -32700, 'Parse error'));
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Server info endpoint
app.get('/', (c) => {
  return c.json({
    name: 'GitHub MCP Server',
    version: '1.0.0',
    description: 'GitHub integration for Warp AI Terminal via Model Context Protocol',
    author: 'Philip S Wright',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
    },
    documentation: 'https://github.com/pdubbbbbs/mcp-servers',
  });
});

export default app;
