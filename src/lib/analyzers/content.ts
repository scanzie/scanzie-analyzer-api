// src/lib/analyzers/content.ts
import * as cheerio from 'cheerio';
import { ContentAnalysis } from '../types';

export class ContentAnalyzer {
  private $: cheerio.CheerioAPI;
  private text: string;

  constructor(html: string) {
    this.$ = cheerio.load(html);
    // Remove script, style, and navigation elements for content analysis
    this.$('script, style, nav, header, footer, aside').remove();
    this.text = this.$('body').text().replace(/\s+/g, ' ').trim();
  }

  async analyze(): Promise<ContentAnalysis> {
    const wordCount = this.getWordCount();
    const readabilityScore = this.calculateReadabilityScore();
    const keywordDensity = this.calculateKeywordDensity();
    const duplicateContent = this.checkDuplicateContent();
    const contentQuality = this.assessContentQuality();

    let score = this.calculateOverallContentScore(
      wordCount,
      readabilityScore,
      contentQuality.score
    );

    const issues: string[] = [];
    
    if (wordCount < 300) {
      issues.push('Content too short (recommended: 300+ words)');
      score -= 20;
    }

    if (readabilityScore < 60) {
      issues.push('Content may be difficult to read');
      score -= 15;
    }

    if (contentQuality.score < 70) {
      issues.push('Content quality could be improved');
      score -= 10;
    }

    return {
      wordCount,
      readabilityScore,
      keywordDensity,
      duplicateContent,
      contentQuality,
      score: Math.max(0, Math.round(score)),
      issues,
    };
  }

  private getWordCount(): number {
    return this.text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadabilityScore(): number {
    // Simplified Flesch Reading Ease formula
    const words = this.text.split(/\s+/).filter(word => word.length > 0);
    const sentences = this.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const syllables = this.countSyllables(this.text);

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private countSyllables(text: string): number {
    // Simple syllable counting (approximate)
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;

    words.forEach(word => {
      let syllables = word.match(/[aeiouy]+/g)?.length || 0;
      if (word.endsWith('e') && syllables > 1) syllables--;
      if (syllables === 0) syllables = 1;
      totalSyllables += syllables;
    });

    return totalSyllables;
  }

  private calculateKeywordDensity(): Record<string, number> {
    const words = this.text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3); // Only words longer than 3 characters

    const wordCount = words.length;
    const wordFrequency: Record<string, number> = {};

    words.forEach(word => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });

    // Convert to density percentages and get top 10
    const density: Record<string, number> = {};
    Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([word, frequency]) => {
        density[word] = Math.round((frequency / wordCount) * 100 * 100) / 100;
      });

    return density;
  }

  private checkDuplicateContent(): { percentage: number; issues: string[] } {
    // Simple duplicate detection (in a real app, you'd check against external sources)
    const paragraphs = this.$('p').map((_, p) => this.$(p).text().trim()).get();
    const duplicateThreshold = 0.85; // 85% similarity
    
    let duplicateCount = 0;
    const issues: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      for (let j = i + 1; j < paragraphs.length; j++) {
        const similarity = this.calculateSimilarity(paragraphs[i], paragraphs[j]);
        if (similarity > duplicateThreshold) {
          duplicateCount++;
        }
      }
    }

    const percentage = paragraphs.length > 0 ? (duplicateCount / paragraphs.length) * 100 : 0;

    if (percentage > 10) {
      issues.push('High percentage of duplicate content detected');
    }

    return {
      percentage: Math.round(percentage * 100) / 100,
      issues,
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private assessContentQuality(): {
    score: number;
    factors: { length: number; uniqueness: number; structure: number };
  } {
    const wordCount = this.getWordCount();
    
    // Length factor (0-100)
    const lengthScore = Math.min(100, (wordCount / 1000) * 100);
    
    // Uniqueness factor (based on word variety)
    const uniqueWords = new Set(this.text.toLowerCase().split(/\s+/)).size;
    const totalWords = this.text.split(/\s+/).length;
    const uniquenessScore = totalWords > 0 ? (uniqueWords / totalWords) * 100 : 0;
    
    // Structure factor (based on headings and paragraphs)
    const headings = this.$('h1, h2, h3, h4, h5, h6').length;
    const paragraphs = this.$('p').length;
    const structureScore = Math.min(100, (headings * 10 + paragraphs * 2));

    const overallScore = (lengthScore + uniquenessScore + structureScore) / 3;

    return {
      score: Math.round(overallScore),
      factors: {
        length: Math.round(lengthScore),
        uniqueness: Math.round(uniquenessScore),
        structure: Math.round(structureScore),
      },
    };
  }

  private calculateOverallContentScore(
    wordCount: number,
    readabilityScore: number,
    qualityScore: number
  ): number {
    let score = 100;

    // Penalize short content
    if (wordCount < 300) score -= 30;
    else if (wordCount < 500) score -= 15;

    // Factor in readability
    if (readabilityScore < 40) score -= 25;
    else if (readabilityScore < 60) score -= 15;

    // Factor in quality
    score = (score + qualityScore) / 2;

    return Math.max(0, score);
  }
}