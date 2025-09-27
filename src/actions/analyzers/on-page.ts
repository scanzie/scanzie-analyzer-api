// src/lib/analyzers/on-page.ts
import * as cheerio from 'cheerio';
import { OnPageAnalysis } from '../../types';

export class OnPageAnalyzer {
  private $: cheerio.CheerioAPI;
  private url: string;

  constructor(html: string, url: string) {
    this.$ = cheerio.load(html) as cheerio.CheerioAPI;
    this.url = url;
  }

  async analyze(): Promise<OnPageAnalysis> {
    const title = await this.analyzeTitle();
    const metaDescription = await this.analyzeMetaDescription();
    const headings = await this.analyzeHeadings();
    const images = await this.analyzeImages();
    const links = await this.analyzeLinks();
    const favicon = await this.analyzeFavicon();
    const openGraph = await this.analyzeOpenGraph();
    const twitterCard = await this.analyzeTwitterCard();

    // Calculate overall score
    const scores = [
      { score: title.score, weight: 0.2 },
      { score: metaDescription.score, weight: 0.15 },
      { score: headings.score, weight: 0.15 },
      { score: images.score, weight: 0.1 },
      { score: links.score, weight: 0.1 },
      { score: favicon.score, weight: 0.05 },
      { score: openGraph.score, weight: 0.15 },
      { score: twitterCard.score, weight: 0.1 }
    ];

    const overallScore = Math.round(
      scores.reduce((total, { score, weight }) => total + (score * weight), 0)
    );

    return {
      title,
      metaDescription,
      headings,
      images,
      links,
      favicon,
      openGraph,
      twitterCard,
      score: overallScore
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
      const nativeEl = element as any;
      const tag = nativeEl && nativeEl.tagName ? String(nativeEl.tagName).toLowerCase() : '';
      const level = tag && tag.length > 1 ? parseInt(tag.charAt(1)) : 0;
      structure.push({
        tag,
        text: $el.text().trim(),
        level,
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

    // Check heading hierarchy (report only first occurrence)
    let previousLevel = 0;
    for (const { level } of structure) {
      if (level > previousLevel + 1) {
      issues.push('Heading hierarchy not properly structured');
      score -= 10;
      break; // stop after reporting once
      }
      previousLevel = level;
    }

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

  private async analyzeOpenGraph() {
    const issues: string[] = [];
    let score = 100;
    
    // Essential OpenGraph tags
    const ogTitle = this.$('meta[property="og:title"]').attr('content') || '';
    const ogDescription = this.$('meta[property="og:description"]').attr('content') || '';
    const ogImage = this.$('meta[property="og:image"]').attr('content') || '';
    const ogUrl = this.$('meta[property="og:url"]').attr('content') || '';
    const ogType = this.$('meta[property="og:type"]').attr('content') || '';
    const ogSiteName = this.$('meta[property="og:site_name"]').attr('content') || '';

    // Optional but recommended tags
    const ogImageWidth = this.$('meta[property="og:image:width"]').attr('content') || '';
    const ogImageHeight = this.$('meta[property="og:image:height"]').attr('content') || '';
    const ogImageAlt = this.$('meta[property="og:image:alt"]').attr('content') || '';
    const ogLocale = this.$('meta[property="og:locale"]').attr('content') || '';

    // Check essential tags
    if (!ogTitle) {
      issues.push('Missing og:title meta tag');
      score -= 20;
    } else if (ogTitle.length > 60) {
      issues.push('og:title too long (recommended: under 60 characters)');
      score -= 10;
    }

    if (!ogDescription) {
      issues.push('Missing og:description meta tag');
      score -= 20;
    } else if (ogDescription.length > 160) {
      issues.push('og:description too long (recommended: under 160 characters)');
      score -= 10;
    }

    if (!ogImage) {
      issues.push('Missing og:image meta tag');
      score -= 15;
    } else {
      if (!ogImageWidth || !ogImageHeight) {
        issues.push('Consider adding og:image:width and og:image:height');
        score -= 5;
      }
      if (!ogImageAlt) {
        issues.push('Missing og:image:alt for accessibility');
        score -= 5;
      }
    }

    if (!ogUrl) {
      issues.push('Missing og:url meta tag');
      score -= 10;
    }

    if (!ogType) {
      issues.push('Missing og:type meta tag');
      score -= 10;
    }

    if (!ogSiteName) {
      issues.push('Consider adding og:site_name meta tag');
      score -= 5;
    }

    if (!ogLocale) {
      issues.push('Consider adding og:locale meta tag');
      score -= 5;
    }

    return {
      title: ogTitle || undefined,
      description: ogDescription || undefined,
      image: ogImage || undefined,
      url: ogUrl || undefined,
      type: ogType || undefined,
      siteName: ogSiteName || undefined,
      imageWidth: ogImageWidth || undefined,
      imageHeight: ogImageHeight || undefined,
      imageAlt: ogImageAlt || undefined,
      locale: ogLocale || undefined,
      score: Math.max(0, score),
      issues,
    };
  }

  private async analyzeTwitterCard() {
    const issues: string[] = [];
    let score = 100;
    
    // Twitter Card tags
    const twitterCard = this.$('meta[name="twitter:card"]').attr('content') || '';
    const twitterTitle = this.$('meta[name="twitter:title"]').attr('content') || '';
    const twitterDescription = this.$('meta[name="twitter:description"]').attr('content') || '';
    const twitterImage = this.$('meta[name="twitter:image"]').attr('content') || '';
    const twitterSite = this.$('meta[name="twitter:site"]').attr('content') || '';
    const twitterCreator = this.$('meta[name="twitter:creator"]').attr('content') || '';
    const twitterImageAlt = this.$('meta[name="twitter:image:alt"]').attr('content') || '';

    // Check essential tags
    if (!twitterCard) {
      issues.push('Missing twitter:card meta tag');
      score -= 20;
    } else {
      const validCardTypes = ['summary', 'summary_large_image', 'app', 'player'];
      if (!validCardTypes.includes(twitterCard)) {
        issues.push('Invalid twitter:card type (use: summary, summary_large_image, app, or player)');
        score -= 15;
      }
    }

    if (!twitterTitle) {
      issues.push('Missing twitter:title meta tag');
      score -= 15;
    } else if (twitterTitle.length > 70) {
      issues.push('twitter:title too long (recommended: under 70 characters)');
      score -= 10;
    }

    if (!twitterDescription) {
      issues.push('Missing twitter:description meta tag');
      score -= 15;
    } else if (twitterDescription.length > 200) {
      issues.push('twitter:description too long (recommended: under 200 characters)');
      score -= 10;
    }

    if (!twitterImage) {
      issues.push('Missing twitter:image meta tag');
      score -= 15;
    } else if (!twitterImageAlt) {
      issues.push('Missing twitter:image:alt for accessibility');
      score -= 10;
    }

    if (!twitterSite) {
      issues.push('Consider adding twitter:site meta tag');
      score -= 10;
    }

    if (!twitterCreator) {
      issues.push('Consider adding twitter:creator meta tag');
      score -= 5;
    }

    return {
      card: twitterCard || undefined,
      title: twitterTitle || undefined,
      description: twitterDescription || undefined,
      image: twitterImage || undefined,
      imageAlt: twitterImageAlt || undefined,
      site: twitterSite || undefined,
      creator: twitterCreator || undefined,
      score: Math.max(0, score),
      issues,
    };
  }
}