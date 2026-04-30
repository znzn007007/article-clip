import * as cheerio from 'cheerio';
import { ZhihuExtractError } from './errors.js';
import { extractZhihuImagesFromHtml } from './images.js';

export interface ZhihuData {
  type: 'article' | 'answer';
  title?: string;
  question?: {
    title: string;
    detail?: string;
  };
  content: string;
  author: {
    name: string;
    url: string;
  };
  publishedAt: string;
  images: string[];
  upvotes?: number;
}

export class ZhihuParser {
  /**
   * Parse from Zhihu's raw state data
   */
  parseFromRawState(state: unknown, url?: string): ZhihuData | null {
    const entities = this.getEntities(state);
    if (!entities) return null;

    const answer = this.entityFromUrl(entities.answers, url, /\/answer\/([^/?#]+)/)
      ?? this.firstEntity(entities.answers);
    if (answer) {
      return this.parseAnswerFromState(answer, entities.questions);
    }

    const article = this.entityFromUrl(entities.articles, url, /\/p\/([^/?#]+)/)
      ?? this.firstEntity(entities.articles);
    if (article) {
      return this.parseArticleFromState(article);
    }

    return null;
  }

  /**
   * Parse from Cheerio
   */
  parseFromCheerio($: cheerio.CheerioAPI, url: string): ZhihuData {
    // Check for Zhihu rate limit / anti-bot error
    const html = $.html();
    const errorMatch = html.match(/\{"error":\{"message":"([^"]+)","code":(\d+)\}\}/);
    if (errorMatch) {
      const [, message, code] = errorMatch;
      if (code === '40362') {
        throw new ZhihuExtractError(
          'Zhihu is blocking automated access. The request was flagged as unusual.',
          'RATE_LIMITED'
        );
      }
      throw new ZhihuExtractError(
        `Zhihu returned an error: ${message}`,
        'CONTENT_NOT_FOUND'
      );
    }

    try {
      const isAnswer = /\/question\/\d+\/answer\/\d+/.test(url);
      return isAnswer ? this.parseAnswer($, url) : this.parseArticle($, url);
    } catch (error) {
      // Return basic fallback with error info
      return {
        type: 'article',
        content: '',
        author: { name: 'Unknown', url: '' },
        publishedAt: new Date().toISOString(),
        images: [],
      };
    }
  }

  private parseAnswer($: cheerio.CheerioAPI, _url: string): ZhihuData {
    // Extract question title (for reference, not displayed)
    const questionTitle = this.extractQuestionTitle($);

    // Extract answer content
    const answerContent = $('.RichContent-inner').html() || '';

    // Extract author - try multiple selectors to get complete name
    let authorName = '';
    const authorSelectors = [
      '.AuthorInfo-name',           // Primary selector
      '.UserLink-link',              // Alternative
      '[itemprop="name"]',           // Schema.org
    ];

    for (const selector of authorSelectors) {
      const el = $(selector).first();
      if (el.length > 0) {
        const name = el.text().trim();
        if (name && name.length > 1) {
          authorName = name;
          break;
        }
      }
    }

    const authorUrl = $('.AuthorInfo-name a').first().attr('href') || '';

    // Extract upvotes
    const upvotesText = $('.VoteButton--up .VoteCount').text().trim();
    const upvotes = this.parseNumber(upvotesText);

    return {
      type: 'answer',
      question: { title: questionTitle },
      content: answerContent,
      author: { name: authorName || '匿名用户', url: authorUrl || '' },
      publishedAt: new Date().toISOString(),
      images: extractZhihuImagesFromHtml(answerContent),
      upvotes,
    };
  }

  private parseArticle($: cheerio.CheerioAPI, _url: string): ZhihuData {
    // Extract title
    const title = $('.Post-Title').text().trim();

    // Extract content
    const content = $('.Post-RichText').html() || $('.RichContent').html() || '';

    // Extract author
    const authorName = $('.AuthorInfo-name').text().trim();
    const authorUrl = $('.AuthorInfo-name a').attr('href') || '';

    return {
      type: 'article',
      title,
      content,
      author: { name: authorName, url: authorUrl || '' },
      publishedAt: new Date().toISOString(),
      images: extractZhihuImagesFromHtml(content),
    };
  }

  private parseNumber(text: string): number {
    const match = text.match(/[\d,]+/);
    if (!match) return 0;
    return parseInt(match[0].replace(/,/g, ''), 10);
  }

  private getEntities(state: unknown): Record<string, any> | null {
    if (!state || typeof state !== 'object') return null;
    const root = state as Record<string, any>;
    const initialState = root.initialState && typeof root.initialState === 'object'
      ? root.initialState as Record<string, any>
      : root;
    const entities = initialState.entities;
    return entities && typeof entities === 'object' ? entities : null;
  }

  private firstEntity(collection: unknown): Record<string, any> | null {
    if (!collection || typeof collection !== 'object') return null;
    const values = Object.values(collection as Record<string, unknown>);
    const entity = values.find(value => value && typeof value === 'object');
    return entity ? entity as Record<string, any> : null;
  }

  private entityFromUrl(
    collection: unknown,
    url: string | undefined,
    pattern: RegExp
  ): Record<string, any> | null {
    if (!url || !collection || typeof collection !== 'object') return null;

    const id = url.match(pattern)?.[1];
    if (!id) return null;

    const entity = (collection as Record<string, unknown>)[id];
    return entity && typeof entity === 'object'
      ? entity as Record<string, any>
      : null;
  }

  private parseAnswerFromState(
    answer: Record<string, any>,
    questions: unknown
  ): ZhihuData {
    const content = this.toString(answer.content);
    const author = answer.author && typeof answer.author === 'object'
      ? answer.author as Record<string, any>
      : {};

    return {
      type: 'answer',
      question: {
        title: this.getQuestionTitleFromState(answer, questions),
      },
      content,
      author: {
        name: this.toString(author.name) || '匿名用户',
        url: this.toString(author.url),
      },
      publishedAt: this.parseTimestamp(answer.createdTime ?? answer.updatedTime),
      images: extractZhihuImagesFromHtml(content),
      upvotes: this.toNumber(answer.voteupCount ?? answer.reaction?.statistics?.upVoteCount),
    };
  }

  private parseArticleFromState(article: Record<string, any>): ZhihuData {
    const content = this.toString(article.content);
    const author = article.author && typeof article.author === 'object'
      ? article.author as Record<string, any>
      : {};

    return {
      type: 'article',
      title: this.toString(article.title),
      content,
      author: {
        name: this.toString(author.name),
        url: this.toString(author.url),
      },
      publishedAt: this.parseTimestamp(article.createdTime ?? article.updatedTime),
      images: extractZhihuImagesFromHtml(content),
    };
  }

  private getQuestionTitleFromState(answer: Record<string, any>, questions: unknown): string {
    const answerQuestion = answer.question && typeof answer.question === 'object'
      ? answer.question as Record<string, any>
      : null;

    const nestedTitle = this.toString(answerQuestion?.title);
    if (nestedTitle) return nestedTitle;

    const questionId = this.toString(answerQuestion?.id ?? answer.questionId);
    if (questionId && questions && typeof questions === 'object') {
      const question = (questions as Record<string, any>)[questionId];
      const title = this.toString(question?.title);
      if (title) return title;
    }

    const firstQuestion = this.firstEntity(questions);
    return this.toString(firstQuestion?.title);
  }

  private extractQuestionTitle($: cheerio.CheerioAPI): string {
    const headingTitle = $('h1.QuestionHeader-title').text().trim();
    if (headingTitle) return headingTitle;

    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    if (ogTitle) return this.cleanAnswerPageTitle(ogTitle);

    const documentTitle = $('title').text().trim();
    if (documentTitle) return this.cleanAnswerPageTitle(documentTitle);

    return '';
  }

  private cleanAnswerPageTitle(title: string): string {
    return title
      .replace(/^\([^)]*\)\s*/, '')
      .replace(/\s+-\s+.+?的回答$/, '')
      .replace(/\s+-\s+知乎$/, '')
      .trim();
  }

  private parseTimestamp(value: unknown): string {
    const numeric = this.toNumber(value);
    if (numeric > 0) {
      return new Date(numeric * 1000).toISOString();
    }
    return new Date().toISOString();
  }

  private toString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
