// Common MCP Protocol Types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// MCP Server Configuration
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  capabilities: string[];
  endpoints: {
    mcp: string;
    health: string;
  };
  documentation: string;
}

// Helper functions for MCP responses
export function createErrorResponse(id: string | number, code: number, message: string, data?: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

export function createSuccessResponse(id: string | number, result: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

export function createInitializeResponse(id: string | number, serverInfo: any): MCPResponse {
  return createSuccessResponse(id, {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo,
  });
}
