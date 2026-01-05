/**
 * Tests for help-content utilities
 */

import {
  helpCategories,
  faqs,
  quickLinks,
  searchArticles,
  getArticleById,
  getCategoryById,
} from './help-content';

describe('helpCategories', () => {
  it('should have required categories', () => {
    const categoryIds = helpCategories.map((c) => c.id);
    expect(categoryIds).toContain('getting-started');
    expect(categoryIds).toContain('features');
    expect(categoryIds).toContain('integrations');
    expect(categoryIds).toContain('account');
  });

  it('should have articles in each category', () => {
    helpCategories.forEach((category) => {
      expect(category.articles.length).toBeGreaterThan(0);
    });
  });

  it('should have required fields for each category', () => {
    helpCategories.forEach((category) => {
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('description');
      expect(category).toHaveProperty('icon');
      expect(category).toHaveProperty('articles');
    });
  });

  it('should have required fields for each article', () => {
    helpCategories.forEach((category) => {
      category.articles.forEach((article) => {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('description');
        expect(article).toHaveProperty('content');
        expect(article).toHaveProperty('category');
        expect(article).toHaveProperty('tags');
        expect(Array.isArray(article.tags)).toBe(true);
      });
    });
  });
});

describe('faqs', () => {
  it('should have FAQs', () => {
    expect(faqs.length).toBeGreaterThan(0);
  });

  it('should have required fields for each FAQ', () => {
    faqs.forEach((faq) => {
      expect(faq).toHaveProperty('question');
      expect(faq).toHaveProperty('answer');
      expect(faq).toHaveProperty('category');
      expect(faq.question).toBeTruthy();
      expect(faq.answer).toBeTruthy();
    });
  });

  it('should include the meeting bot question', () => {
    const botQuestion = faqs.find((f) =>
      f.question.includes('How does zigznote join my meetings')
    );
    expect(botQuestion).toBeDefined();
    expect(botQuestion?.answer).toContain('bot');
  });
});

describe('quickLinks', () => {
  it('should have quick links', () => {
    expect(quickLinks.length).toBeGreaterThan(0);
  });

  it('should have required fields for each link', () => {
    quickLinks.forEach((link) => {
      expect(link).toHaveProperty('title');
      expect(link).toHaveProperty('href');
      expect(link).toHaveProperty('icon');
    });
  });
});

describe('searchArticles', () => {
  it('should return empty array for empty query', () => {
    expect(searchArticles('')).toEqual([]);
    expect(searchArticles('   ')).toEqual([]);
  });

  it('should find articles by title', () => {
    const results = searchArticles('Welcome');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Welcome');
  });

  it('should find articles by description', () => {
    const results = searchArticles('calendar');
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (r) =>
          r.title.toLowerCase().includes('calendar') ||
          r.description.toLowerCase().includes('calendar')
      )
    ).toBe(true);
  });

  it('should find articles by tags', () => {
    const results = searchArticles('slack');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.tags.includes('slack'))).toBe(true);
  });

  it('should find articles by content', () => {
    const results = searchArticles('transcription');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should be case-insensitive', () => {
    const resultsLower = searchArticles('welcome');
    const resultsUpper = searchArticles('WELCOME');
    const resultsMixed = searchArticles('WeLcOmE');

    expect(resultsLower.length).toBe(resultsUpper.length);
    expect(resultsLower.length).toBe(resultsMixed.length);
  });

  it('should return no results for non-matching query', () => {
    const results = searchArticles('xyznonexistent123');
    expect(results).toEqual([]);
  });
});

describe('getArticleById', () => {
  it('should find article by id', () => {
    const article = getArticleById('welcome');
    expect(article).not.toBeNull();
    expect(article?.title).toBe('Welcome to zigznote');
  });

  it('should return null for non-existent id', () => {
    const article = getArticleById('nonexistent-article');
    expect(article).toBeNull();
  });

  it('should find articles from different categories', () => {
    const welcomeArticle = getArticleById('welcome');
    const slackArticle = getArticleById('slack');

    expect(welcomeArticle?.category).toBe('getting-started');
    expect(slackArticle?.category).toBe('integrations');
  });
});

describe('getCategoryById', () => {
  it('should find category by id', () => {
    const category = getCategoryById('getting-started');
    expect(category).not.toBeNull();
    expect(category?.name).toBe('Getting Started');
  });

  it('should return null for non-existent id', () => {
    const category = getCategoryById('nonexistent-category');
    expect(category).toBeNull();
  });

  it('should find all defined categories', () => {
    const categoryIds = ['getting-started', 'features', 'integrations', 'account'];

    categoryIds.forEach((id) => {
      const category = getCategoryById(id);
      expect(category).not.toBeNull();
      expect(category?.id).toBe(id);
    });
  });
});
