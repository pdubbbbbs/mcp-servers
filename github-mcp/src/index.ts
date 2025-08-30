import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GitHubClient } from './github';
import {
  MCPRequest,
  MCPResponse,
  MCPError,
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
      required: ['owner', 'repo', 'title'],\n    },\n  },\n  {\n    name: 'list_pull_requests',\n    description: 'List pull requests in a repository',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        owner: { type: 'string', description: 'Repository owner' },\n        repo: { type: 'string', description: 'Repository name' },\n        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Pull request state' },\n      },\n      required: ['owner', 'repo'],\n    },\n  },\n  {\n    name: 'create_pull_request',\n    description: 'Create a new pull request',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        owner: { type: 'string', description: 'Repository owner' },\n        repo: { type: 'string', description: 'Repository name' },\n        title: { type: 'string', description: 'Pull request title' },\n        body: { type: 'string', description: 'Pull request description' },\n        head: { type: 'string', description: 'Branch to merge from' },\n        base: { type: 'string', description: 'Branch to merge into' },\n        draft: { type: 'boolean', description: 'Create as draft' },\n      },\n      required: ['owner', 'repo', 'title', 'head', 'base'],\n    },\n  },\n  {\n    name: 'search_repositories',\n    description: 'Search for repositories',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        query: { type: 'string', description: 'Search query' },\n        sort: { type: 'string', enum: ['stars', 'forks', 'help-wanted-issues', 'updated'], description: 'Sort by' },\n        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },\n      },\n      required: ['query'],\n    },\n  },\n  {\n    name: 'search_issues',\n    description: 'Search for issues and pull requests',\n    inputSchema: {\n      type: 'object',\n      properties: {\n        query: { type: 'string', description: 'Search query' },\n        sort: { type: 'string', enum: ['comments', 'reactions', 'author-date', 'committer-date', 'updated'], description: 'Sort by' },\n        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },\n      },\n      required: ['query'],\n    },\n  },\n];\n\n// Helper function to create MCP error response\nfunction createErrorResponse(id: string | number, code: number, message: string, data?: any): MCPResponse {\n  return {\n    jsonrpc: '2.0',\n    id,\n    error: { code, message, data },\n  };\n}\n\n// Helper function to create MCP success response\nfunction createSuccessResponse(id: string | number, result: any): MCPResponse {\n  return {\n    jsonrpc: '2.0',\n    id,\n    result,\n  };\n}\n\n// Main MCP endpoint\napp.post('/mcp', async (c) => {\n  try {\n    const env = c.env as Env;\n    const githubToken = env.GITHUB_TOKEN;\n\n    if (!githubToken) {\n      return c.json(createErrorResponse(0, -32000, 'GitHub token not configured'));\n    }\n\n    const request: MCPRequest = await c.req.json();\n    const github = new GitHubClient(githubToken);\n\n    // Handle MCP method calls\n    switch (request.method) {\n      case 'tools/list': {\n        return c.json(createSuccessResponse(request.id, { tools: MCP_TOOLS }));\n      }\n\n      case 'tools/call': {\n        const { name, arguments: args } = request.params;\n        \n        try {\n          let result: any;\n\n          switch (name) {\n            case 'list_repositories':\n              result = await github.listRepositories(args as ListRepositoriesRequest);\n              break;\n\n            case 'get_repository':\n              result = await github.getRepository(args.owner, args.repo);\n              break;\n\n            case 'create_repository':\n              result = await github.createRepository(args as CreateRepositoryRequest);\n              break;\n\n            case 'list_issues':\n              result = await github.listIssues(args as ListIssuesRequest);\n              break;\n\n            case 'create_issue':\n              result = await github.createIssue(args as CreateIssueRequest);\n              break;\n\n            case 'list_pull_requests':\n              result = await github.listPullRequests(args.owner, args.repo, args.state);\n              break;\n\n            case 'create_pull_request':\n              result = await github.createPullRequest(args as CreatePullRequestRequest);\n              break;\n\n            case 'search_repositories':\n              result = await github.searchRepositories(args.query, args.sort, args.order);\n              break;\n\n            case 'search_issues':\n              result = await github.searchIssues(args.query, args.sort, args.order);\n              break;\n\n            default:\n              return c.json(createErrorResponse(request.id, -32601, `Unknown tool: ${name}`));\n          }\n\n          return c.json(createSuccessResponse(request.id, {\n            content: [{\n              type: 'text',\n              text: JSON.stringify(result, null, 2),\n            }],\n          }));\n        } catch (error) {\n          const errorMessage = error instanceof Error ? error.message : 'Unknown error';\n          return c.json(createErrorResponse(request.id, -32000, `Tool execution failed: ${errorMessage}`));\n        }\n      }\n\n      case 'initialize': {\n        return c.json(createSuccessResponse(request.id, {\n          protocolVersion: '2024-11-05',\n          capabilities: {\n            tools: {},\n          },\n          serverInfo: {\n            name: 'GitHub MCP Server',\n            version: '1.0.0',\n            description: 'GitHub integration for Warp AI Terminal via MCP',\n          },\n        }));\n      }\n\n      default:\n        return c.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));\n    }\n  } catch (error) {\n    console.error('MCP server error:', error);\n    return c.json(createErrorResponse(0, -32700, 'Parse error'));\n  }\n});\n\n// Health check endpoint\napp.get('/health', (c) => {\n  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });\n});\n\n// Server info endpoint\napp.get('/', (c) => {\n  return c.json({\n    name: 'GitHub MCP Server',\n    version: '1.0.0',\n    description: 'GitHub integration for Warp AI Terminal via Model Context Protocol',\n    author: 'Philip S Wright',\n    endpoints: {\n      mcp: '/mcp',\n      health: '/health',\n    },\n    documentation: 'https://github.com/pdubbbbbs/mcp-servers',\n  });\n});\n\nexport default app;",
      "required": ["owner", "repo", "title"],
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
    const env = c.env as Env;
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
