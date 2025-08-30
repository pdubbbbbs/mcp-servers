// MCP Protocol Types (reused from GitHub MCP)
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

// Puppeteer-specific Types
export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFOptions {
  format?: 'A4' | 'A3' | 'A5' | 'Legal' | 'Letter' | 'Tabloid';
  width?: string;
  height?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  landscape?: boolean;
}

export interface ScrapingResult {
  url: string;
  title: string;
  data: Record<string, any>;
  timestamp: string;
}

export interface LinkData {
  text: string;
  href: string;
  title?: string;
}

export interface ImageData {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface FormData {
  selector: string;
  fields: Record<string, string>;
}

export interface WaitOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

export interface ScrapeRequest {
  url: string;
  selectors: Record<string, string>;
  waitOptions?: WaitOptions;
}

export interface ScreenshotRequest {
  url: string;
  options?: ScreenshotOptions;
  waitOptions?: WaitOptions;
}

export interface PDFRequest {
  url: string;
  options?: PDFOptions;
  waitOptions?: WaitOptions;
}

export interface ElementScreenshotRequest {
  url: string;
  selector: string;
  options?: ScreenshotOptions;
  waitOptions?: WaitOptions;
}

export interface FormSubmissionRequest {
  url: string;
  formData: FormData;
  waitOptions?: WaitOptions;
}

export interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}
