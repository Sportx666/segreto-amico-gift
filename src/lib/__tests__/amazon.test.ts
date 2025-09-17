/**
 * Unit tests for Amazon affiliate link utilities
 * Verifies that affiliate tags are correctly applied to Amazon URLs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAffiliateTag, productUrlFromASIN, ideaBucketUrl, getAffiliateTag } from '../amazon';

// Mock import.meta.env
const mockImportMeta = {
  env: {
    PROD: false
  }
};

vi.stubGlobal('import', {
  meta: mockImportMeta
});

describe('Amazon Affiliate Link Utilities', () => {
  beforeEach(() => {
    // Reset environment mock
    mockImportMeta.env.PROD = false;
    vi.clearAllMocks();
  });

  describe('getAffiliateTag', () => {
    it('should return fallback tag in development', () => {
      mockImportMeta.env.PROD = false;
      const tag = getAffiliateTag();
      expect(tag).toBe('yourtag-21');
    });

    it('should warn in production with fallback tag', () => {
      mockImportMeta.env.PROD = true;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const tag = getAffiliateTag();
      expect(tag).toBe('yourtag-21');
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Amazon affiliate tag not properly configured for production');
      
      consoleSpy.mockRestore();
    });
  });

  describe('withAffiliateTag', () => {
    it('should add affiliate tag to Amazon.it URLs', () => {
      const originalUrl = 'https://www.amazon.it/dp/B08N5WRWNW';
      const result = withAffiliateTag(originalUrl);
      
      expect(result).toContain('tag=yourtag-21');
      expect(result).toEqual('https://www.amazon.it/dp/B08N5WRWNW?tag=yourtag-21');
    });

    it('should update existing affiliate tag', () => {
      const originalUrl = 'https://www.amazon.it/dp/B08N5WRWNW?tag=oldtag-21';
      const result = withAffiliateTag(originalUrl);
      
      expect(result).toContain('tag=yourtag-21');
      expect(result).not.toContain('tag=oldtag-21');
      expect(result).toEqual('https://www.amazon.it/dp/B08N5WRWNW?tag=yourtag-21');
    });

    it('should preserve other query parameters', () => {
      const originalUrl = 'https://www.amazon.it/dp/B08N5WRWNW?ref=sr_1_1&keywords=test';
      const result = withAffiliateTag(originalUrl);
      
      expect(result).toContain('tag=yourtag-21');
      expect(result).toContain('ref=sr_1_1');
      expect(result).toContain('keywords=test');
    });

    it('should use custom tag when provided', () => {
      const originalUrl = 'https://www.amazon.it/dp/B08N5WRWNW';
      const customTag = 'customtag-21';
      const result = withAffiliateTag(originalUrl, customTag);
      
      expect(result).toContain(`tag=${customTag}`);
      expect(result).toEqual(`https://www.amazon.it/dp/B08N5WRWNW?tag=${customTag}`);
    });

    it('should handle different Amazon domains', () => {
      const testCases = [
        'https://www.amazon.com/dp/B08N5WRWNW',
        'https://www.amazon.co.uk/dp/B08N5WRWNW',
        'https://www.amazon.de/dp/B08N5WRWNW',
        'https://www.amazon.fr/dp/B08N5WRWNW'
      ];

      testCases.forEach(url => {
        const result = withAffiliateTag(url);
        expect(result).toContain('tag=yourtag-21');
      });
    });

    it('should not modify non-Amazon URLs', () => {
      const nonAmazonUrls = [
        'https://www.google.com',
        'https://www.ebay.com/item/123456',
        'https://www.example.com'
      ];

      nonAmazonUrls.forEach(url => {
        const result = withAffiliateTag(url);
        expect(result).toEqual(url);
        expect(result).not.toContain('tag=');
      });
    });

    it('should handle invalid URLs gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const invalidUrls = [
        'not-a-url',
        '',
        'ftp://invalid-protocol.com'
      ];

      invalidUrls.forEach(url => {
        const result = withAffiliateTag(url);
        expect(result).toEqual(url);
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('productUrlFromASIN', () => {
    it('should generate correct product URL with affiliate tag', () => {
      const asin = 'B08N5WRWNW';
      const result = productUrlFromASIN(asin);
      
      expect(result).toEqual('https://www.amazon.it/dp/B08N5WRWNW?tag=yourtag-21');
    });

    it('should include SEO-friendly slug when title provided', () => {
      const asin = 'B08N5WRWNW';
      const title = 'Amazing Product Title!';
      const result = productUrlFromASIN(asin, title);
      
      expect(result).toContain('/dp/B08N5WRWNW/amazing-product-title');
      expect(result).toContain('tag=yourtag-21');
    });

    it('should sanitize title for slug', () => {
      const asin = 'B08N5WRWNW';
      const title = 'Product with Special Characters!@#$%^&*()';
      const result = productUrlFromASIN(asin, title);
      
      expect(result).toContain('/dp/B08N5WRWNW/product-with-special-characters');
      expect(result).not.toContain('!@#$%^&*()');
    });

    it('should truncate long titles', () => {
      const asin = 'B08N5WRWNW';
      const longTitle = 'This is a very long product title that should be truncated because it exceeds the maximum length limit';
      const result = productUrlFromASIN(asin, longTitle);
      
      const urlParts = result.split('/dp/B08N5WRWNW/');
      if (urlParts.length > 1) {
        const slug = urlParts[1].split('?')[0];
        expect(slug.length).toBeLessThanOrEqual(50);
      }
    });
  });

  describe('ideaBucketUrl', () => {
    it('should generate search URL with budget and affiliate tag', () => {
      const budget = 50;
      const result = ideaBucketUrl(budget);
      
      expect(result).toContain('amazon.it/s');
      expect(result).toContain('k=idee+regalo+sotto+50+euro');
      expect(result).toContain('tag=yourtag-21');
    });

    it('should accept custom topic', () => {
      const budget = 100;
      const topic = 'gadget tecnologici';
      const result = ideaBucketUrl(budget, topic);
      
      expect(result).toContain('k=gadget+tecnologici+sotto+100+euro');
      expect(result).toContain('tag=yourtag-21');
    });
  });

  describe('Real-world URL examples', () => {
    it('should handle actual Amazon product URLs', () => {
      const realUrls = [
        'https://www.amazon.it/Apple-iPhone-13-128GB-Azzurro/dp/B09G9FPHY6/ref=sr_1_3',
        'https://www.amazon.it/gp/product/B08N5WRWNW?psc=1',
        'https://www.amazon.it/dp/B08N5WRWNW?th=1&psc=1'
      ];

      realUrls.forEach(url => {
        const result = withAffiliateTag(url);
        expect(result).toContain('tag=yourtag-21');
        expect(new URL(result).hostname).toContain('amazon.it');
      });
    });

    it('should provide example of final affiliate URL', () => {
      const asin = 'B08N5WRWNW';
      const title = 'Echo Dot (4ª generazione)';
      const result = productUrlFromASIN(asin, title);
      
      // This should be a valid, affiliate-tagged Amazon URL
      expect(result).toMatch(/^https:\/\/www\.amazon\.it\/dp\/B08N5WRWNW\/echo-dot-4-generazione\?tag=yourtag-21$/);
      
      console.log('Example affiliate URL:', result);
    });
  });
});