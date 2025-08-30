import { Hono } from 'hono';
import { cors } from 'hono/cors';
import puppeteer from '@cloudflare/puppeteer';
import { PuppeteerClient } from './puppeteer';
import {
  MCPRequest,
  MCPResponse,
  MCPTool,
  ScreenshotRequest,
  PDFRequest,
} from './types';

// Additional interfaces for the server
interface ElementScreenshotRequest {
  url: string;
  selector: string;
  options?: {
    format?: 'png' | 'jpeg';
    quality?: number;
  };
}

interface ScrapeRequest {
  url: string;
  selectors: Record<string, string>;
  waitOptions?: {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  };
}

interface FormSubmissionRequest {
  url: string;
  formData: {
    selector: string;
    fields: Record<string, string>;
  };
}

const app = new Hono();

// Enable CORS for Warp
app.use('/mcp/*', cors({
  origin: ['https://app.warp.dev', 'https://*.warp.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// Environment interface
interface Env {
  BROWSER: any;
}

// MCP Tools Definition
const MCP_TOOLS: MCPTool[] = [
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to screenshot' },
        options: {
          type: 'object',
          properties: {
            width: { type: 'number', description: 'Viewport width' },
            height: { type: 'number', description: 'Viewport height' },
            fullPage: { type: 'boolean', description: 'Capture full page' },
            format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format' },
            quality: { type: 'number', minimum: 0, maximum: 100, description: 'JPEG quality (0-100)' },
          },
        },
        waitOptions: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Wait timeout in ms' },
            waitUntil: { 
              type: 'string', 
              enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
              description: 'Wait condition'
            },
          },
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'screenshot_element',
    description: 'Take a screenshot of a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to visit' },
        selector: { type: 'string', description: 'CSS selector for element' },
        options: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format' },
            quality: { type: 'number', minimum: 0, maximum: 100, description: 'JPEG quality (0-100)' },
          },
        },
      },
      required: ['url', 'selector'],
    },
  },
  {
    name: 'generate_pdf',
    description: 'Generate a PDF from a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to convert to PDF' },
        options: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['A4', 'A3', 'A5', 'Legal', 'Letter', 'Tabloid'], description: 'Paper format' },
            landscape: { type: 'boolean', description: 'Landscape orientation' },
            printBackground: { type: 'boolean', description: 'Include background graphics' },
            margin: {
              type: 'object',
              properties: {
                top: { type: 'string', description: 'Top margin' },
                right: { type: 'string', description: 'Right margin' },
                bottom: { type: 'string', description: 'Bottom margin' },
                left: { type: 'string', description: 'Left margin' },
              },
            },
          },
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'scrape_data',
    description: 'Scrape structured data from a web page using CSS selectors',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to scrape' },
        selectors: {
          type: 'object',
          description: 'Key-value pairs of field names and CSS selectors',
          additionalProperties: { type: 'string' },
        },
        waitOptions: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Wait timeout in ms' },
            waitUntil: { 
              type: 'string', 
              enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
              description: 'Wait condition'
            },
          },
        },
      },
      required: ['url', 'selectors'],
    },
  },
  {
    name: 'extract_text',
    description: 'Extract text content from a web page or specific element',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to extract text from' },
        selector: { type: 'string', description: 'Optional CSS selector for specific element' },
      },
      required: ['url'],
    },
  },
  {
    name: 'extract_links',
    description: 'Extract all links from a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to extract links from' },
      },
      required: ['url'],
    },
  },
  {
    name: 'extract_images',
    description: 'Extract all images from a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to extract images from' },
      },
      required: ['url'],
    },
  },
  {
    name: 'fill_form',
    description: 'Fill and submit a form on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL with the form' },
        formData: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Form CSS selector' },
            fields: {
              type: 'object',
              description: 'Key-value pairs of field selectors and values',
              additionalProperties: { type: 'string' },
            },
          },
          required: ['selector', 'fields'],
        },
      },
      required: ['url', 'formData'],
    },
  },
  {
    name: 'click_element',
    description: 'Click an element on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to visit' },
        selector: { type: 'string', description: 'CSS selector for element to click' },
      },
      required: ['url', 'selector'],
    },
  },
  {
    name: 'wait_for_element',
    description: 'Wait for an element to appear on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to visit' },
        selector: { type: 'string', description: 'CSS selector for element to wait for' },
        timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 },
      },
      required: ['url', 'selector'],
    },
  },
];

// Helper functions
function createErrorResponse(id: string | number, code: number, message: string, data?: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

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
    const browser = env.BROWSER;

    if (!browser) {
      return c.json(createErrorResponse(0, -32000, 'Browser not available'));
    }

    const request: MCPRequest = await c.req.json();
    const puppeteerBrowser = await puppeteer.launch(browser);
    const client = new PuppeteerClient(puppeteerBrowser);

    try {
      switch (request.method) {
        case 'tools/list': {
          return c.json(createSuccessResponse(request.id, { tools: MCP_TOOLS }));
        }

        case 'tools/call': {
          const { name, arguments: args } = request.params;
          
          let result: any;

          switch (name) {
            case 'take_screenshot':
              result = await client.takeScreenshot(args as ScreenshotRequest);
              break;

            case 'screenshot_element':
              result = await client.takeElementScreenshot(args as ElementScreenshotRequest);
              break;

            case 'generate_pdf':
              result = await client.generatePDF(args as PDFRequest);
              break;

            case 'scrape_data':
              result = await client.scrapeData(args as ScrapeRequest);
              break;

            case 'extract_text':
              result = await client.extractText(args.url, args.selector, args.waitOptions);
              break;

            case 'extract_links':
              result = await client.extractLinks(args.url, args.waitOptions);
              break;

            case 'extract_images':
              result = await client.extractImages(args.url, args.waitOptions);
              break;

            case 'fill_form':
              result = await client.fillForm(args as FormSubmissionRequest);
              break;

            case 'click_element':
              result = await client.clickElement(args.url, args.selector, args.waitOptions);
              break;

            case 'wait_for_element':
              result = await client.waitForElement(args.url, args.selector, args.timeout);
              break;

            default:
              return c.json(createErrorResponse(request.id, -32601, `Unknown tool: ${name}`));
          }

          return c.json(createSuccessResponse(request.id, {
            content: [{
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            }],
          }));
        }

        case 'initialize': {
          return c.json(createSuccessResponse(request.id, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'Puppeteer MCP Server',
              version: '1.0.0',
              description: 'Web scraping and browser automation for Warp AI Terminal via MCP',
            },
          }));
        }

        default:
          return c.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
      }
    } finally {
      await puppeteerBrowser.close();
    }
  } catch (error) {
    console.error('MCP server error:', error);
    return c.json(createErrorResponse(0, -32700, 'Parse error'));
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    capabilities: ['screenshots', 'pdf-generation', 'web-scraping', 'form-automation']
  });
});

// Server info endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Puppeteer MCP Server',
    version: '1.0.0',
    description: 'Web scraping and browser automation for Warp AI Terminal via Model Context Protocol',
    author: 'Philip S Wright',
    capabilities: [
      'Full page screenshots',
      'Element screenshots', 
      'PDF generation',
      'Data scraping with CSS selectors',
      'Link and image extraction',
      'Form automation',
      'Element interaction',
      'Wait conditions'
    ],
    endpoints: {
      mcp: '/mcp',
      health: '/health',
    },
    documentation: 'https://github.com/pdubbbbbs/mcp-servers',
  });
});

export default app;
