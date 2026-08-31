import { extractEmbeddedProductCodeFromEan13 } from './product-code-matching';

describe('extractEmbeddedProductCodeFromEan13', () => {
  it('should extract the five digits before the EAN-13 check digit', () => {
    expect(extractEmbeddedProductCodeFromEan13('7891033859474')).toBe('85947');
  });

  it('should reject an EAN-13 with an invalid check digit', () => {
    expect(extractEmbeddedProductCodeFromEan13('7891033859475')).toBeNull();
  });

  it('should ignore values that are not EAN-13 codes', () => {
    expect(extractEmbeddedProductCodeFromEan13('85947')).toBeNull();
  });
});
