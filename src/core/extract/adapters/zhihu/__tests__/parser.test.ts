import { describe, it, expect, jest } from '@jest/globals';
import * as cheerio from 'cheerio';
import { ZhihuParser } from '../parser.js';
import { ZhihuExtractError } from '../errors.js';

const load = (html: string) => cheerio.load(html);

describe('ZhihuParser', () => {
  it('throws RATE_LIMITED on anti-bot error code 40362', () => {
    const html = '<html>{"error":{"message":"blocked","code":40362}}</html>';
    const parser = new ZhihuParser();

    expect(() => parser.parseFromCheerio(load(html), 'https://zhihu.com/question/1'))
      .toThrowError(ZhihuExtractError);

    try {
      parser.parseFromCheerio(load(html), 'https://zhihu.com/question/1');
    } catch (err) {
      expect((err as ZhihuExtractError).code).toBe('RATE_LIMITED');
    }
  });

  it('throws CONTENT_NOT_FOUND for other error codes', () => {
    const html = '<html>{"error":{"message":"not found","code":404}}</html>';
    const parser = new ZhihuParser();

    expect.assertions(2);
    try {
      parser.parseFromCheerio(load(html), 'https://zhihu.com/question/1');
    } catch (err) {
      expect(err).toBeInstanceOf(ZhihuExtractError);
      expect((err as ZhihuExtractError).code).toBe('CONTENT_NOT_FOUND');
    }
  });

  it('parses answer pages', () => {
    const html = `
      <h1 class="QuestionHeader-title">Question Title</h1>
      <div class="RichContent-inner">
        <p>Answer content</p>
        <img src="https://pic.zhimg.com/abc_b.jpg" />
        <img src="https://pic.zhimg.com/avatar.png" />
      </div>
      <div class="AuthorInfo-name"><a href="/people/test">Test User</a></div>
      <button class="VoteButton--up"><span class="VoteCount">1,234</span></button>
    `;
    const parser = new ZhihuParser();
    const result = parser.parseFromCheerio(load(html), 'https://www.zhihu.com/question/1/answer/2');

    expect(result.type).toBe('answer');
    expect(result.question?.title).toBe('Question Title');
    expect(result.author.name).toBe('Test User');
    expect(result.upvotes).toBe(1234);
    expect(result.images[0]).toContain('_r.jpg');
  });

  it('parses answer data from raw initial state', () => {
    const state = {
      initialState: {
        entities: {
          questions: {
            '605657565': {
              title: '普通散户有什么“笨”方法在A股赚钱？',
            },
          },
          answers: {
            '2016591139625530432': {
              type: 'answer',
              content: '<p>Answer content</p><img src="https://pic.zhimg.com/abc_b.jpg">',
              createdTime: 1686292211,
              voteupCount: 583,
              author: {
                name: 'forward',
                url: 'https://www.zhihu.com/api/v4/people/forward',
              },
              question: {
                id: '605657565',
              },
            },
          },
        },
      },
    };
    const parser = new ZhihuParser();
    const result = parser.parseFromRawState(state, 'https://www.zhihu.com/question/605657565/answer/2016591139625530432');

    expect(result?.type).toBe('answer');
    expect(result?.question?.title).toBe('普通散户有什么“笨”方法在A股赚钱？');
    expect(result?.author.name).toBe('forward');
    expect(result?.upvotes).toBe(583);
    expect(result?.images).toEqual(['https://pic.zhimg.com/abc_r.jpg']);
  });

  it('selects the raw answer matching the current answer URL', () => {
    const state = {
      initialState: {
        entities: {
          questions: {
            '1': { title: 'Target Question' },
          },
          answers: {
            'first': {
              content: '<p>Wrong answer</p>',
              author: { name: 'First Author' },
              question: { id: '1' },
            },
            'target': {
              content: '<p>Target answer</p>',
              author: { name: 'Target Author' },
              question: { id: '1' },
            },
          },
        },
      },
    };
    const parser = new ZhihuParser();
    const result = parser.parseFromRawState(state, 'https://www.zhihu.com/question/1/answer/target');

    expect(result?.author.name).toBe('Target Author');
    expect(result?.content).toBe('<p>Target answer</p>');
  });

  it('uses og:title as fallback question title for answer pages', () => {
    const html = `
      <meta property="og:title" content="Real Question Title - Alice 的回答">
      <div class="RichContent-inner"><p>Answer content</p></div>
      <div class="AuthorInfo-name">Alice</div>
    `;
    const parser = new ZhihuParser();
    const result = parser.parseFromCheerio(load(html), 'https://www.zhihu.com/question/1/answer/2');

    expect(result.type).toBe('answer');
    expect(result.question?.title).toBe('Real Question Title');
  });

  it('filters Zhihu svg placeholders and prefers original image attributes', () => {
    const html = `
      <h1 class="QuestionHeader-title">Question Title</h1>
      <div class="RichContent-inner">
        <img src="data:image/svg+xml;base64,PHN2Zy8+" data-original="https://pic.zhimg.com/real_b.jpg" />
        <img src="https://static.zhihu.com/heifetz/assets/placeholder.svg" />
        <img src="https://pic.zhimg.com/avatar.png" />
      </div>
      <div class="AuthorInfo-name">Author</div>
    `;
    const parser = new ZhihuParser();
    const result = parser.parseFromCheerio(load(html), 'https://www.zhihu.com/question/1/answer/2');

    expect(result.images).toEqual(['https://pic.zhimg.com/real_r.jpg']);
  });

  it('parses article pages', () => {
    const html = `
      <div class="Post-Title">Article Title</div>
      <div class="Post-RichText">
        <p>Article content</p>
        <img src="https://pic.zhimg.com/200_200_/xyz_b.png" />
      </div>
      <div class="AuthorInfo-name"><a href="/people/author">Author Name</a></div>
    `;
    const parser = new ZhihuParser();
    const result = parser.parseFromCheerio(load(html), 'https://zhuanlan.zhihu.com/p/123');

    expect(result.type).toBe('article');
    expect(result.title).toBe('Article Title');
    expect(result.author.name).toBe('Author Name');
    expect(result.images[0]).toContain('/2000_2000/');
  });

  it('returns null for raw state stub', () => {
    const parser = new ZhihuParser();
    expect(parser.parseFromRawState({})).toBeNull();
  });

  it('uses fallback author selector when primary is missing', () => {
    const html = `
      <h1 class="QuestionHeader-title">Question Title</h1>
      <div class="RichContent-inner"><p>Answer content</p></div>
      <a class="UserLink-link" href="/people/alt">Alt Author</a>
      <button class="VoteButton--up"><span class="VoteCount"></span></button>
    `;
    const parser = new ZhihuParser();
    const result = parser.parseFromCheerio(load(html), 'https://www.zhihu.com/question/1/answer/2');

    expect(result.author.name).toBe('Alt Author');
    expect(result.upvotes).toBe(0);
  });

  it('falls back to basic data when parse throws', () => {
    const html = `<div class="Post-Title">Title</div>`;
    const parser = new ZhihuParser();
    const parseSpy = jest.spyOn(parser as any, 'parseArticle').mockImplementation(() => {
      throw new Error('boom');
    });

    const result = parser.parseFromCheerio(load(html), 'https://zhuanlan.zhihu.com/p/123');

    parseSpy.mockRestore();

    expect(result.author.name).toBe('Unknown');
    expect(result.content).toBe('');
  });
});
