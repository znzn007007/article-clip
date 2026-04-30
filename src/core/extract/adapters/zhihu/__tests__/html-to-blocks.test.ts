import { describe, it, expect } from '@jest/globals';
import { ZhihuHtmlToBlocks } from '../html-to-blocks.js';

describe('ZhihuHtmlToBlocks', () => {
  it('converts common elements into blocks', () => {
    const html = `
      <h2>Heading</h2>
      <p>Paragraph</p>
      <blockquote>Quote</blockquote>
      <pre><code class="language-ts">const x = 1;</code></pre>
      <ul><li>Item 1</li><li>Item 2</li></ul>
      <ol><li>First</li><li>Second</li></ol>
      <img src="https://img.zhihu.com/a.jpg" alt="A" />
      <a href="https://example.com">Link</a>
      <div><span>Nested</span></div>
    `;

    const converter = new ZhihuHtmlToBlocks();
    const blocks = converter.convert(html);

    expect(blocks).toEqual(
      expect.arrayContaining([
        { type: 'heading', level: 2, content: 'Heading' },
        { type: 'paragraph', content: 'Paragraph' },
        { type: 'quote', content: 'Quote' },
        { type: 'code', content: 'const x = 1;', language: 'ts' },
        { type: 'list', items: ['Item 1', 'Item 2'], ordered: false },
        { type: 'list', items: ['First', 'Second'], ordered: true },
        { type: 'image', url: 'https://img.zhihu.com/a.jpg', alt: 'A' },
        { type: 'link', url: 'https://example.com', title: 'Link' },
        { type: 'paragraph', content: 'Nested' },
      ])
    );
  });

  it('converts root text nodes and unknown tags', () => {
    const html = `
      Plain text
      <custom>Inner <p>Nested paragraph</p></custom>
    `;

    const converter = new ZhihuHtmlToBlocks();
    const blocks = converter.convert(html);

    expect(blocks).toEqual(
      expect.arrayContaining([
        { type: 'paragraph', content: 'Plain text' },
        { type: 'paragraph', content: 'Nested paragraph' },
      ])
    );
  });

  it('skips svg placeholders and uses original Zhihu image attributes', () => {
    const html = `
      <p>Before</p>
      <img src="data:image/svg+xml;base64,PHN2Zy8+" data-original="https://pic.zhimg.com/real_b.jpg" alt="real" />
      <img src="https://static.zhihu.com/heifetz/assets/placeholder.svg" alt="placeholder" />
      <img src="https://pic.zhimg.com/avatar.png" alt="avatar" />
    `;

    const converter = new ZhihuHtmlToBlocks();
    const blocks = converter.convert(html);

    expect(blocks).toEqual(
      expect.arrayContaining([
        { type: 'paragraph', content: 'Before' },
        { type: 'image', url: 'https://pic.zhimg.com/real_r.jpg', alt: 'real' },
      ])
    );
    expect(blocks.filter(block => block.type === 'image')).toHaveLength(1);
  });
});
