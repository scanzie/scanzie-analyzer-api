// src/lib/analyzers/on-page.ts
import * as cheerio from 'cheerio';
import { OnPageAnalysis } from '../types';

export class OnPageAnalyzer {
  private $: cheerio.CheerioAPI;
  private url: string;

  constructor(html: string, url: string) {
    this.$ = cheerio.load(html) as cheerio.CheerioAPI;
    this.url = url;
  }

  async analyze(): Promise<OnPageAnalysis> {
    return {
      title: await this.analyzeTitle(),
      metaDescription: await this.analyzeMetaDescription(),
      headings: await this.analyzeHeadings(),
      images: await this.analyzeImages(),
      links: await this.analyzeLinks(),
      favicon: await this.analyzeFavicon(),
    };
  }

  private async analyzeTitle() {
    const titleElement = this.$('title').first();
    const text = titleElement.text().trim();
    const length = text.length;
    
    const issues: string[] = [];
    let score = 100;

    if (!text) {
      issues.push('Missing page title');
      score = 0;
    } else {
      if (length < 30) {
        issues.push('Title too short (recommended: 50-60 characters)');
        score -= 20;
      }
      if (length > 60) {
        issues.push('Title too long (recommended: 50-60 characters)');
        score -= 15;
      }
      if (!text.includes('|') && !text.includes('-')) {
        issues.push('Consider adding brand name to title');
        score -= 10;
      }
    }

    return {
      exists: !!text,
      length,
      text: text || undefined,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeMetaDescription() {
    const metaDesc = this.$('meta[name="description"]').attr('content') || '';
    const length = metaDesc.length;
    
    const issues: string[] = [];
    let score = 100;

    if (!metaDesc) {
      issues.push('Missing meta description');
      score = 0;
    } else {
      if (length < 120) {
        issues.push('Meta description too short (recommended: 150-160 characters)');
        score -= 20;
      }
      if (length > 160) {
        issues.push('Meta description too long (recommended: 150-160 characters)');
        score -= 15;
      }
      if (!metaDesc.toLowerCase().includes('click') && !metaDesc.toLowerCase().includes('learn')) {
        issues.push('Consider adding a call-to-action');
        score -= 10;
      }
    }

    return {
      exists: !!metaDesc,
      length,
      text: metaDesc || undefined,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeHeadings() {
    const headings = this.$('h1, h2, h3, h4, h5, h6');
    const h1Count = this.$('h1').length;
    const h2Count = this.$('h2').length;
    
    const structure: Array<{ tag: string; text: string; level: number }> = [];
    headings.each((_, element) => {
      const $el = this.$(element);
      structure.push({
        tag: (element.data?.toLowerCase()) || '',
        text: $el.text().trim(),
        level: parseInt(element.data?.charAt(1) || '0'),
      });
    });

    const issues: string[] = [];
    let score = 100;

    if (h1Count === 0) {
      issues.push('Missing H1 tag');
      score -= 30;
    } else if (h1Count > 1) {
      issues.push('Multiple H1 tags found (should have only one)');
      score -= 20;
    }

    if (h2Count === 0) {
      issues.push('No H2 tags found (recommended for content structure)');
      score -= 15;
    }

    // Check heading hierarchy
    let previousLevel = 0;
    structure.forEach(({ level }) => {
      if (level > previousLevel + 1) {
        issues.push('Heading hierarchy not properly structured');
        score -= 10;
        return;
      }
      previousLevel = level;
    });

    return {
      h1Count,
      h2Count,
      structure,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeImages() {
    const images = this.$('img');
    const total = images.length;
    let withoutAlt = 0;

    images.each((_, img) => {
      const alt = this.$(img).attr('alt');
      if (!alt || alt.trim() === '') {
        withoutAlt++;
      }
    });

    const issues: string[] = [];
    let score = 100;

    if (withoutAlt > 0) {
      issues.push(`${withoutAlt} image(s) missing alt text`);
      score -= (withoutAlt / total) * 40;
    }

    if (total === 0) {
      issues.push('No images found (consider adding relevant images)');
      score -= 10;
    }

    return {
      total,
      withoutAlt,
      score: Math.max(0, Math.round(score)),
      issues,
    };
  }

  private async analyzeLinks() {
    const allLinks = this.$('a[href]');
    let internal = 0;
    let external = 0;
    const broken = 0; // Would require actual HTTP checks

    allLinks.each((_, link) => {
      const href = this.$(link).attr('href') || '';
      
      if (href.startsWith('http') && !href.includes(new URL(this.url).hostname)) {
        external++;
      } else if (href.startsWith('/') || href.includes(new URL(this.url).hostname)) {
        internal++;
      }
    });

    const issues: string[] = [];
    let score = 100;

    if (internal === 0) {
      issues.push('No internal links found');
      score -= 20;
    }

    if (external === 0) {
      issues.push('No external links found (consider linking to authoritative sources)');
      score -= 10;
    }

    return {
      internal,
      external,
      broken,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeFavicon() {
    const issues: string[] = [];
    let score = 100;
    let faviconUrl: string | null = null;
    let exists = false;

    try {
      const baseUrl = new URL(this.url);
      
      // Check for various favicon link tags
      const faviconSelectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]'
      ];

      for (const selector of faviconSelectors) {
        const faviconLink = this.$(selector).first();
        if (faviconLink.length > 0) {
          let href = faviconLink.attr('href');
          if (href) {
            // Convert relative URLs to absolute
            if (href.startsWith('/')) {
              faviconUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
            } else if (!href.startsWith('http')) {
              faviconUrl = `${baseUrl.protocol}//${baseUrl.host}/${href}`;
            } else {
              faviconUrl = href;
            }
            exists = true;
            break;
          }
        }
      }

      // If no favicon link tag found, check for default favicon.ico
      if (!faviconUrl) {
        faviconUrl = `${baseUrl.protocol}//${baseUrl.host}/favicon.ico`;
        // Note: We can't actually check if this exists without making an HTTP request
        // This would need to be done separately if you want to verify accessibility
      }

      if (!exists) {
        issues.push('No favicon link tag found in HTML');
        score -= 20;
        issues.push('Consider adding <link rel="icon" href="/favicon.ico"> to <head>');
      }

      // Check for multiple sizes (good practice)
      const appleTouchIcons = this.$('link[rel="apple-touch-icon"]').length;
      const regularIcons = this.$('link[rel="icon"]').length;
      
      if (exists && appleTouchIcons === 0) {
        issues.push('Consider adding Apple touch icons for better mobile support');
        score -= 10;
      }

      if (exists && regularIcons === 1) {
        const iconLink = this.$('link[rel="icon"]').first();
        const sizes = iconLink.attr('sizes');
        if (!sizes) {
          issues.push('Consider specifying favicon sizes attribute');
          score -= 5;
        }
      }

    } catch (error) {
      issues.push('Error analyzing favicon');
      score = 50;
    }

    return {
      exists,
      url: faviconUrl,
      score: Math.max(0, score),
      issues,
    };
  }
}