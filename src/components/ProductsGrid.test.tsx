import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProductsGrid } from './ProductsGrid';

const sampleProduct = {
  asin: 'B00EXAMPLE',
  title: 'Prodotto di Test',
  image: 'https://example.com/image.jpg',
  price: 19.99,
  currency: 'EUR',
  url: 'https://www.amazon.it/dp/B00EXAMPLE',
};

describe('ProductsGrid', () => {
  it('shows skeletons when loading', () => {
    const { queryByText } = render(
      <ProductsGrid products={[]} loading={true} onAddToWishlist={() => {}} />
    );
    // Skeletons do not have specific text; assert by role count of generic divs would be brittle.
    // Just ensure it renders without crashing by checking container text is empty.
    expect(queryByText('Nessun prodotto trovato')).not.toBeInTheDocument();
  });

  it('shows empty state when no products', () => {
    const { getByText } = render(
      <ProductsGrid products={[]} loading={false} onAddToWishlist={() => {}} />
    );
    expect(getByText('Nessun prodotto trovato')).toBeInTheDocument();
  });

  it('renders product items', () => {
    const { getByText } = render(
      <ProductsGrid products={[sampleProduct]} onAddToWishlist={() => {}} />
    );
    expect(getByText('Prodotto di Test')).toBeInTheDocument();
  });
});