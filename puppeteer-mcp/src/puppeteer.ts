import puppeteer from '@cloudflare/puppeteer';
import {
  ScreenshotOptions,
  PDFOptions,
  ScrapeRequest,
  ScreenshotRequest,
  PDFRequest,
  ElementScreenshotRequest,
  FormSubmissionRequest,
  LinkData,
  ImageData,
  ScrapingResult,
  WaitOptions,
} from './types';

export class PuppeteerClient {
  private browser: any;

  constructor(browser: any) {
    this.browser = browser;
  }

  private async createPage() {
    return await this.browser.newPage();
  }

  private async waitForPageLoad(page: any, options: WaitOptions = {}) {
    const { timeout = 30000, waitUntil = 'networkidle2' } = options;
    
    try {
      await page.waitForLoadState(waitUntil, { timeout });
    } catch (error) {
      console.warn('Page load timeout, continuing anyway');
    }
  }

  // Screenshot operations
  async takeScreenshot(request: ScreenshotRequest): Promise<string> {
    const page = await this.createPage();
    
    try {
      // Set viewport if specified
      if (request.options?.width && request.options?.height) {
        await page.setViewportSize({
          width: request.options.width,
          height: request.options.height,
        });
      }

      await page.goto(request.url);
      await this.waitForPageLoad(page, request.waitOptions);

      const screenshotOptions: any = {
        fullPage: request.options?.fullPage ?? true,
        type: request.options?.format ?? 'png',
      };

      if (request.options?.quality && request.options.format === 'jpeg') {
        screenshotOptions.quality = request.options.quality;
      }

      if (request.options?.clip) {
        screenshotOptions.clip = request.options.clip;
      }

      const screenshot = await page.screenshot(screenshotOptions);
      return `data:image/${request.options?.format ?? 'png'};base64,${screenshot.toString('base64')}`;
    } finally {
      await page.close();
    }
  }

  async takeElementScreenshot(request: ElementScreenshotRequest): Promise<string> {
    const page = await this.createPage();
    
    try {
      await page.goto(request.url);
      await this.waitForPageLoad(page, request.waitOptions);

      const element = await page.locator(request.selector).first();
      
      if (!element) {
        throw new Error(`Element not found: ${request.selector}`);
      }

      const screenshotOptions: any = {
        type: request.options?.format ?? 'png',
      };

      if (request.options?.quality && request.options.format === 'jpeg') {
        screenshotOptions.quality = request.options.quality;
      }

      const screenshot = await element.screenshot(screenshotOptions);
      return `data:image/${request.options?.format ?? 'png'};base64,${screenshot.toString('base64')}`;
    } finally {
      await page.close();
    }
  }

  // PDF generation
  async generatePDF(request: PDFRequest): Promise<string> {
    const page = await this.createPage();
    
    try {
      await page.goto(request.url);
      await this.waitForPageLoad(page, request.waitOptions);

      const pdfOptions: any = {
        format: request.options?.format ?? 'A4',
        printBackground: request.options?.printBackground ?? true,
        landscape: request.options?.landscape ?? false,
      };

      if (request.options?.margin) {
        pdfOptions.margin = request.options.margin;
      }

      if (request.options?.width && request.options?.height) {
        pdfOptions.width = request.options.width;
        pdfOptions.height = request.options.height;
      }

      const pdf = await page.pdf(pdfOptions);
      return `data:application/pdf;base64,${pdf.toString('base64')}`;
    } finally {
      await page.close();
    }
  }

  // Web scraping operations
  async scrapeData(request: ScrapeRequest): Promise<ScrapingResult> {
    const page = await this.createPage();
    
    try {
      await page.goto(request.url);
      await this.waitForPageLoad(page, request.waitOptions);

      const title = await page.title();
      const data: Record<string, any> = {};

      // Extract data using provided selectors
      for (const [key, selector] of Object.entries(request.selectors)) {
        try {
          const element = page.locator(selector).first();
          
          // Try different extraction methods
          const text = await element.textContent();
          const innerHTML = await element.innerHTML();
          const href = await element.getAttribute('href');
          const src = await element.getAttribute('src');

          data[key] = {
            text: text?.trim(),
            html: innerHTML,
            href,
            src,
          };
        } catch (error) {
          data[key] = { error: `Element not found: ${selector}` };
        }
      }

      return {
        url: request.url,
        title,
        data,
        timestamp: new Date().toISOString(),
      };
    } finally {
      await page.close();
    }
  }

  async extractLinks(url: string, waitOptions?: WaitOptions): Promise<LinkData[]> {
    const page = await this.createPage();
    
    try {
      await page.goto(url);
      await this.waitForPageLoad(page, waitOptions);

      const links = await page.locator('a[href]').all();
      const linkData: LinkData[] = [];

      for (const link of links) {
        const href = await link.getAttribute('href');
        const text = (await link.textContent())?.trim();
        const title = await link.getAttribute('title');

        if (href) {
          linkData.push({
            href,
            text: text || '',
            title: title || undefined,
          });
        }
      }

      return linkData;
    } finally {
      await page.close();
    }
  }

  async extractImages(url: string, waitOptions?: WaitOptions): Promise<ImageData[]> {
    const page = await this.createPage();
    
    try {
      await page.goto(url);
      await this.waitForPageLoad(page, waitOptions);

      const images = await page.locator('img[src]').all();
      const imageData: ImageData[] = [];

      for (const img of images) {
        const src = await img.getAttribute('src');
        const alt = await img.getAttribute('alt');
        const title = await img.getAttribute('title');

        if (src) {
          imageData.push({
            src,
            alt: alt || undefined,
            title: title || undefined,
          });
        }
      }

      return imageData;
    } finally {
      await page.close();
    }
  }

  async extractText(url: string, selector?: string, waitOptions?: WaitOptions): Promise<string> {
    const page = await this.createPage();
    
    try {
      await page.goto(url);
      await this.waitForPageLoad(page, waitOptions);

      if (selector) {
        const element = page.locator(selector).first();
        const text = await element.textContent();
        return text?.trim() || '';
      } else {
        const text = await page.locator('body').textContent();
        return text?.trim() || '';
      }
    } finally {
      await page.close();
    }
  }

  // Form automation
  async fillForm(request: FormSubmissionRequest): Promise<{ success: boolean; message: string }> {
    const page = await this.createPage();
    
    try {
      await page.goto(request.url);
      await this.waitForPageLoad(page, request.waitOptions);

      // Fill form fields
      for (const [fieldSelector, value] of Object.entries(request.formData.fields)) {
        const element = page.locator(fieldSelector);
        
        if (await element.isVisible()) {
          await element.fill(value);
        } else {
          console.warn(`Field not found or not visible: ${fieldSelector}`);
        }
      }

      // Submit the form
      const form = page.locator(request.formData.selector);
      await form.submit();

      // Wait for navigation or response
      await this.waitForPageLoad(page, { timeout: 10000 });

      return {
        success: true,
        message: 'Form submitted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await page.close();
    }
  }

  async clickElement(url: string, selector: string, waitOptions?: WaitOptions): Promise<{ success: boolean; message: string }> {
    const page = await this.createPage();
    
    try {
      await page.goto(url);
      await this.waitForPageLoad(page, waitOptions);

      const element = page.locator(selector).first();
      
      if (await element.isVisible()) {
        await element.click();
        
        // Wait for any potential navigation
        await this.waitForPageLoad(page, { timeout: 5000 });
        
        return {
          success: true,
          message: 'Element clicked successfully',
        };
      } else {
        return {
          success: false,
          message: `Element not found or not visible: ${selector}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await page.close();
    }
  }

  async waitForElement(url: string, selector: string, timeout: number = 30000): Promise<{ success: boolean; message: string }> {
    const page = await this.createPage();
    
    try {
      await page.goto(url);
      
      const element = page.locator(selector);
      await element.waitFor({ timeout });
      
      return {
        success: true,
        message: 'Element found',
      };
    } catch (error) {
      return {
        success: false,
        message: `Element not found within ${timeout}ms: ${selector}`,
      };
    } finally {
      await page.close();
    }
  }
}
