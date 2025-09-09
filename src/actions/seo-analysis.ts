import axios from 'axios'
import { OnPageAnalyzer } from '../lib/analyzers/on-page';
import { ContentAnalyzer } from '../lib/analyzers/content';
import { TechnicalAnalyzer } from '../lib/analyzers/technical';

const validateUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const normalizedUrl = urlObj.toString();
    return normalizedUrl;
  } catch (error) {
    throw new Error(`Invalid URL provided: ${url}`);
  }
}

const fetchHTML = async (url: string) => {
  const normalizedUrl = validateUrl(url)
  try {
    const response = await axios.get(normalizedUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 SEO-Analyzer-Bot/1.0',
      },
      maxRedirects: 5,
    });
    const html = response.data;
    return html;
  } catch (error) {
    throw new Error(`Failed to fetch website content: ${error}`);
  }
}

export const performOnPageAnalysis = async (url: string, options?: any) => {
  const validatedUrl = validateUrl(url)
  const html = await fetchHTML(url)

  const onPageAnalyzer = new OnPageAnalyzer(html,validatedUrl)
  const result = await onPageAnalyzer.analyze();
  return result;
};

export const performContentAnalysis = async (url: string, options?: any) => {
  const html = await fetchHTML(url)
  const contentAnalyzer = new ContentAnalyzer(html)
  const result = await contentAnalyzer.analyze();
  return result;
};

export const performTechnicalAnalysis = async (url: string, options?: any) => {
  const validatedUrl = validateUrl(url)
  const html = await fetchHTML(url)

  const technicalAnalyzer = new TechnicalAnalyzer(html,validatedUrl)
  const result = await technicalAnalyzer.analyze();
  return result;
};