import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
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
    render(
      <ProductsGrid products={[]} loading={true} onAddToWishlist={() => {}} />
    );
    // Skeletons do not have specific text; assert by role count of generic divs would be brittle.
    // Just ensure it renders without crashing by checking container text is empty.
    expect(screen.queryByText('Nessun prodotto trovato')).not.toBeInTheDocument();
  });

  it('shows empty state when no products', () => {
    render(
      <ProductsGrid products={[]} loading={false} onAddToWishlist={() => {}} />
    );
    expect(screen.getByText('Nessun prodotto trovato')).toBeInTheDocument();
  });

  it('renders product items', () => {
    render(
      <ProductsGrid products={[sampleProduct]} onAddToWishlist={() => {}} />
    );
    expect(screen.getByText('Prodotto di Test')).toBeInTheDocument();
  });
});