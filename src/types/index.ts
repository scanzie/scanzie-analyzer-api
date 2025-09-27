export interface SEOAnalysisRequest {
  url: string;
  userId?: string;
  options?: {
    includeImages?: boolean;
    checkMobile?: boolean;
    depthLimit?: number;
  };
}

export interface OnPageAnalysis {
  title: {
    exists: boolean;
    length: number;
    text?: string;
    score: number;
    issues: string[];
  };
  metaDescription: {
    exists: boolean;
    length: number;
    text?: string;
    score: number;
    issues: string[];
  };
  headings: {
    h1Count: number;
    h2Count: number;
    structure: Array<{ tag: string; text: string; level: number }>;
    score: number;
    issues: string[];
  };
  images: {
    total: number;
    withoutAlt: number;
    score: number;
    issues: string[];
  };
  links: {
    internal: number;
    external: number;
    broken: number;
    score: number;
    issues: string[];
  };
  favicon: {
    url: string | null;
    exists: boolean;
    score: number;
    issues: string[];
  };
  openGraph: {},
  twitterCard: {};
  score: number;
}

export interface ContentAnalysis {
  wordCount: number;
  readabilityScore: number;
  keywordDensity: Record<string, number>;
  duplicateContent: {
    percentage: number;
    issues: string[];
  };
  contentQuality: {
    score: number;
    factors: {
      length: number;
      uniqueness: number;
      structure: number;
    };
  };
  score: number;
  issues: string[];
}

export interface TechnicalAnalysis {
  pageSpeed: {
    loadTime: number;
    score: number;
    recommendations: string[];
  };
  mobile: {
    responsive: boolean;
    score: number;
    issues: string[];
  };
  ssl: {
    enabled: boolean;
    score: number;
  };
  structure: {
    validHTML: boolean;
    score: number;
    errors: string[];
  };
  robots: {
    exists: boolean;
    accessible: boolean;
    issues: string[];
  };
  sitemap: {
    exists: boolean;
    accessible: boolean;
    issues: string[];
  };
  score: number;
  issues: string[];
}

export interface SEOAnalysisResult {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  overallScore: number;
  onPage: OnPageAnalysis;
  content: ContentAnalysis;
  technical: TechnicalAnalysis;
  recommendations: string[];
  error?: string;
}

export interface SEOJobData {
  url: string;
  userId: string;
  timestamp: number;
  options: any;
  analysisType: 'on-page' | 'content' | 'technical';
}