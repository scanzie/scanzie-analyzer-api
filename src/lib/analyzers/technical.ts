// src/lib/analyzers/technical.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { TechnicalAnalysis } from '../../types';

export class TechnicalAnalyzer {
  private url: string;
  private html: string;
  private $: cheerio.CheerioAPI;

  constructor(html: string, url: string) {
    this.html = html;
    this.url = url;
    this.$ = cheerio.load(html) as cheerio.CheerioAPI;
  }

  async analyze(): Promise<TechnicalAnalysis> {
    const pageSpeed = await this.analyzePageSpeed();
    const mobile = await this.analyzeMobileResponsiveness();
    const ssl = await this.analyzeSSL();
    const structure = await this.analyzeHTMLStructure();
    const robots = await this.analyzeRobotsTxt();
    const sitemap = await this.analyzeSitemap();

    const issues: string[] = [];
    let totalScore = 0;
    let factorCount = 0;

    // Calculate weighted average score
    [pageSpeed, mobile, ssl, structure].forEach(analysis => {
      totalScore += analysis.score;
      factorCount++;
    });

    const score = factorCount > 0 ? Math.round(totalScore / factorCount) : 0;

    // Collect all issues
    [pageSpeed, mobile, structure, robots, sitemap].forEach(analysis => {
      if ('issues' in analysis) {
        issues.push(...analysis.issues);
      }
      if ('recommendations' in analysis) {
        issues.push(...analysis.recommendations);
      }
    });

    return {
      pageSpeed,
      mobile,
      ssl,
      structure,
      robots,
      sitemap,
      score,
      issues,
    };
  }

  private async analyzePageSpeed(): Promise<{
    loadTime: number;
    score: number;
    recommendations: string[];
  }> {
    const apiKey = process.env.GOOGLE_PAGES_SPEED_API_KEY;

    // Fallback to simple measurement if API key is missing
    if (!apiKey) {
      try {
        const startTime = Date.now();
        await axios.get(this.url, { timeout: 10000 });
        const loadTime = Date.now() - startTime;
        const recommendations: string[] = [];
        let score = 100;
        if (loadTime > 3000) {
          recommendations.push('Page load time is slow (>3 seconds)');
          score -= 30;
        } else if (loadTime > 2000) {
          recommendations.push('Page load time could be improved');
          score -= 15;
        }
        return { loadTime, score: Math.max(0, score), recommendations };
      } catch (error) {
        return {
          loadTime: 0,
          score: 0,
          recommendations: ['Could not measure page speed - site may be unreachable and GOOGLE_PAGES_SPEED_API_KEY is not set'],
        };
      }
    }

    try {
      const resp = await axios.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
        params: {
          url: this.url,
          key: apiKey,
          strategy: 'mobile',
        },
        timeout: 15000,
      });

      const lhr = (resp.data && resp.data.lighthouseResult) ? resp.data.lighthouseResult : null;

      if (!lhr) {
        return {
          loadTime: 0,
          score: 0,
          recommendations: ['Pagespeed API returned no lighthouse result'],
        };
      }

      // Performance score is 0..1 in Lighthouse result
      const rawScore = lhr.categories?.performance?.score ?? 0;
      const score = Math.round(rawScore * 100);

      // Try to extract an overall load time (use interactive as a proxy)
      const interactiveMs = lhr.audits?.interactive?.numericValue ?? null;
      const fcpMs = lhr.audits?.['first-contentful-paint']?.numericValue ?? null;
      const loadTime = Math.round((interactiveMs ?? fcpMs ?? 0));

      const recommendations: string[] = [];

      // Collect audits with low score (numeric scores are 0..1). Limit to 10 items.
      const audits = lhr.audits || {};
      for (const auditId of Object.keys(audits)) {
        const audit = audits[auditId] as any;
        if (typeof audit.score === 'number' && audit.score < 0.9) {
          const title = audit.title || auditId;
          // Prefer brief guidance if available
          const message = audit.displayValue || audit.description || '';
          recommendations.push(message ? `${title}: ${message}` : title);
          if (recommendations.length >= 10) break;
        }
      }

      // If no specific recommendations found, provide some generic ones based on counts in the HTML
      if (recommendations.length === 0) {
        const scripts = this.$('script').length;
        const stylesheets = this.$('link[rel="stylesheet"]').length;
        const images = this.$('img').length;

        if (scripts > 10) recommendations.push('Too many JavaScript files (consider bundling)');
        if (stylesheets > 5) recommendations.push('Too many CSS files (consider combining)');
        if (images > 20) recommendations.push('Many images detected (optimize and use modern formats)');
        if (!this.html.includes('gzip') && !this.html.includes('br')) recommendations.push('Enable compression (gzip/brotli)');
      }

      return {
        loadTime,
        score: Math.max(0, score),
        recommendations,
      };
    } catch (error) {
      // On error, fallback to a simple timing measurement
      try {
        const startTime = Date.now();
        await axios.get(this.url, { timeout: 10000 });
        const loadTime = Date.now() - startTime;
        const recommendations = ['Could not call PageSpeed API - using a simple fallback measurement'];
        let score = 100;
        if (loadTime > 3000) {
          recommendations.push('Page load time is slow (>3 seconds)');
          score -= 30;
        } else if (loadTime > 2000) {
          recommendations.push('Page load time could be improved');
          score -= 15;
        }
        return { loadTime, score: Math.max(0, score), recommendations };
      } catch (err) {
        return {
          loadTime: 0,
          score: 0,
          recommendations: ['Could not measure page speed - site may be unreachable or PageSpeed API call failed'],
        };
      }
    }
  }

  private async analyzeMobileResponsiveness(): Promise<{
    responsive: boolean;
    score: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let score = 100;
    let responsive = true;

    // Check viewport meta tag
    const viewport = this.$('meta[name="viewport"]').attr('content');
    if (!viewport) {
      issues.push('Missing viewport meta tag');
      responsive = false;
      score -= 40;
    } else if (!viewport.includes('width=device-width')) {
      issues.push('Viewport not set to device width');
      score -= 20;
    }

    // Check for responsive design indicators
    const hasMediaQueries = this.html.includes('@media');
    if (!hasMediaQueries) {
      issues.push('No responsive CSS media queries detected');
      score -= 30;
    }

    // Check for fixed width elements
    const fixedWidthElements = this.$('[width], [style*="width:"]').length;
    if (fixedWidthElements > 5) {
      issues.push('Many fixed-width elements detected');
      score -= 15;
    }

    // Check for mobile-unfriendly elements
    const smallText = this.$('*').filter((_, el) => {
      const style = this.$(el).attr('style') || '';
      if (style.includes('font-size')) {
        const match = style.match(/font-size:\s*(\d+)px/);
        if (match) {
          return parseInt(match[1], 10) < 12;
        }
      }
      return false;
    }).length;

    if (smallText > 0) {
      issues.push('Small text detected (may be hard to read on mobile)');
      score -= 10;
    }

    return {
      responsive: responsive && score > 50,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeSSL(): Promise<{ enabled: boolean; score: number }> {
    const isHTTPS = this.url.startsWith('https://');
    
    return {
      enabled: isHTTPS,
      score: isHTTPS ? 100 : 0,
    };
  }

  private async analyzeHTMLStructure(): Promise<{
    validHTML: boolean;
    score: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let score = 100;

    // Basic HTML validation checks
    if (!this.html.includes('<!DOCTYPE')) {
      errors.push('Missing DOCTYPE declaration');
      score -= 20;
    }

    if (!this.$('html').attr('lang')) {
      errors.push('Missing language attribute on HTML element');
      score -= 15;
    }

    if (this.$('title').length === 0) {
      errors.push('Missing title element');
      score -= 25;
    }

    if (this.$('meta[charset]').length === 0 && !this.html.includes('charset=')) {
      errors.push('Missing character encoding declaration');
      score -= 10;
    }

    // Check for duplicate IDs
    const ids: string[] = [];
    const duplicateIds: string[] = [];
    
    this.$('[id]').each((_, el) => {
      const id = this.$(el).attr('id');
      if (id && ids.includes(id) && !duplicateIds.includes(id)) {
        duplicateIds.push(id);
      } else if (id) {
        ids.push(id);
      }
    });

    if (duplicateIds.length > 0) {
      errors.push(`Duplicate IDs found: ${duplicateIds.join(', ')}`);
      score -= duplicateIds.length * 5;
    }

    // Check for missing alt attributes on images
    const imagesWithoutAlt = this.$('img:not([alt])').length;
    if (imagesWithoutAlt > 0) {
      errors.push(`${imagesWithoutAlt} images missing alt attributes`);
      score -= Math.min(20, imagesWithoutAlt * 2);
    }

    return {
      validHTML: errors.length === 0,
      score: Math.max(0, score),
      errors,
    };
  }

  private async analyzeRobotsTxt(): Promise<{
    exists: boolean;
    accessible: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let exists = false;
    let accessible = false;

    try {
      const robotsUrl = new URL('/robots.txt', this.url).toString();
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      
      exists = true;
      accessible = response.status === 200;

      if (accessible) {
        const robotsContent = response.data;
        
        if (!robotsContent.includes('User-agent:')) {
          issues.push('robots.txt missing User-agent directive');
        }

        if (!robotsContent.includes('Sitemap:')) {
          issues.push('robots.txt missing Sitemap directive');
        }
      }
    } catch (error) {
      issues.push('robots.txt not found or inaccessible');
    }

    return { exists, accessible, issues };
  }

  private async analyzeSitemap(): Promise<{
    exists: boolean;
    accessible: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    let exists = false;
    let accessible = false;

    try {
      // Check common sitemap locations
      const sitemapUrls = [
        new URL('/sitemap.xml', this.url).toString(),
        new URL('/sitemap_index.xml', this.url).toString(),
        new URL('/sitemaps/sitemap.xml', this.url).toString(),
      ];

      for (const sitemapUrl of sitemapUrls) {
        try {
          const response = await axios.get(sitemapUrl, { timeout: 5000 });
          if (response.status === 200) {
            exists = true;
            accessible = true;

            // Basic sitemap validation
            const sitemapContent = response.data;
            if (!sitemapContent.includes('<urlset') && !sitemapContent.includes('<sitemapindex')) {
              issues.push('Sitemap format may be invalid');
            }

            if (!sitemapContent.includes('<loc>')) {
              issues.push('Sitemap missing URL locations');
            }

            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!exists) {
        issues.push('XML sitemap not found in common locations');
      }
    } catch (error) {
      issues.push('Could not access sitemap');
    }

    return { exists, accessible, issues };
  }
}