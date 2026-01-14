// Curated gift products for public Gift Guide page
// All products include affiliate-tagged Amazon URLs

import { productUrlFromASIN } from '@/lib/amazon';

export interface CuratedProduct {
  asin: string;
  title: string;
  imageUrl: string;
  price: string;
  category: string;
}

export interface GiftCategory {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  products: CuratedProduct[];
}

// Helper to generate product with affiliate URL
const product = (asin: string, title: string, imageUrl: string, price: string, category: string): CuratedProduct => ({
  asin,
  title,
  imageUrl,
  price,
  category,
});

export const curatedCategories: GiftCategory[] = [
  {
    id: 'under-10',
    titleKey: 'gift_guide.categories.under_10.title',
    descriptionKey: 'gift_guide.categories.under_10.description',
    icon: '💰',
    products: [
      product('B07V3KXJP8', 'Set Candele Profumate', 'https://m.media-amazon.com/images/I/71+mDoHG4WL._AC_SL1500_.jpg', '€9,99', 'under-10'),
      product('B08N5WRWNW', 'Portachiavi Multifunzione', 'https://m.media-amazon.com/images/I/71RqF8xJHQL._AC_SL1500_.jpg', '€7,99', 'under-10'),
      product('B09NQMJ9XY', 'Calzini Divertenti Set', 'https://m.media-amazon.com/images/I/81uQZ9h5-9L._AC_SL1500_.jpg', '€8,99', 'under-10'),
      product('B07PXGQC1Q', 'Tazza Termica da Viaggio', 'https://m.media-amazon.com/images/I/61r7wE+1RRL._AC_SL1500_.jpg', '€9,99', 'under-10'),
    ],
  },
  {
    id: 'under-20',
    titleKey: 'gift_guide.categories.under_20.title',
    descriptionKey: 'gift_guide.categories.under_20.description',
    icon: '🎁',
    products: [
      product('B0BSHF7WHG', 'Lampada LED Smart', 'https://m.media-amazon.com/images/I/61Qqg+IAGRL._AC_SL1500_.jpg', '€19,99', 'under-20'),
      product('B08MQZYSVC', 'Set Cura della Pelle', 'https://m.media-amazon.com/images/I/71bS5jEoXSL._AC_SL1500_.jpg', '€18,99', 'under-20'),
      product('B0C1N4HBQY', 'Caricatore Wireless', 'https://m.media-amazon.com/images/I/61CGxhCJ-DL._AC_SL1500_.jpg', '€15,99', 'under-20'),
      product('B07WJ5D3H4', 'Diario e Penna Premium', 'https://m.media-amazon.com/images/I/71YG7xYjNNL._AC_SL1500_.jpg', '€16,99', 'under-20'),
    ],
  },
  {
    id: 'under-50',
    titleKey: 'gift_guide.categories.under_50.title',
    descriptionKey: 'gift_guide.categories.under_50.description',
    icon: '✨',
    products: [
      product('B0BX7DQMR8', 'Auricolari Bluetooth', 'https://m.media-amazon.com/images/I/61f1YfTkTDL._AC_SL1500_.jpg', '€39,99', 'under-50'),
      product('B09V3KBMTC', 'Diffusore Aromi Smart', 'https://m.media-amazon.com/images/I/61CGKodHGTL._AC_SL1500_.jpg', '€34,99', 'under-50'),
      product('B0BDJMKDR7', 'Orologio Fitness Tracker', 'https://m.media-amazon.com/images/I/61LtuNqW-IL._AC_SL1500_.jpg', '€45,99', 'under-50'),
      product('B08HR7SV3M', 'Set da Picnic Deluxe', 'https://m.media-amazon.com/images/I/81sCMFHIYEL._AC_SL1500_.jpg', '€42,99', 'under-50'),
    ],
  },
  {
    id: 'for-her',
    titleKey: 'gift_guide.categories.for_her.title',
    descriptionKey: 'gift_guide.categories.for_her.description',
    icon: '💝',
    products: [
      product('B09R7H6J5B', 'Set Trucchi Professionale', 'https://m.media-amazon.com/images/I/71y+jzR8KRL._AC_SL1500_.jpg', '€29,99', 'for-her'),
      product('B0C5H8WDXN', 'Borsa Elegante', 'https://m.media-amazon.com/images/I/71q+rWbVOCL._AC_SL1500_.jpg', '€35,99', 'for-her'),
      product('B0989NTHQN', 'Set Gioielli Argento', 'https://m.media-amazon.com/images/I/61nY+gI2PNL._AC_SL1500_.jpg', '€24,99', 'for-her'),
      product('B07PJNBP23', 'Plaid Morbido Premium', 'https://m.media-amazon.com/images/I/81iyOJQnXKL._AC_SL1500_.jpg', '€27,99', 'for-her'),
    ],
  },
  {
    id: 'for-him',
    titleKey: 'gift_guide.categories.for_him.title',
    descriptionKey: 'gift_guide.categories.for_him.description',
    icon: '🎮',
    products: [
      product('B07SQRR39N', 'Set Barba Completo', 'https://m.media-amazon.com/images/I/81+xrQ7KKJL._AC_SL1500_.jpg', '€29,99', 'for-him'),
      product('B0BTR9K6SB', 'Portafoglio Pelle RFID', 'https://m.media-amazon.com/images/I/71eSpB-RoWL._AC_SL1500_.jpg', '€22,99', 'for-him'),
      product('B0BHZYJFTL', 'Accessori Scrivania Premium', 'https://m.media-amazon.com/images/I/71Wjr8pLqDL._AC_SL1500_.jpg', '€34,99', 'for-him'),
      product('B09FJ5S75H', 'Kit Attrezzi Multiuso', 'https://m.media-amazon.com/images/I/71fTJqb9iyL._AC_SL1500_.jpg', '€38,99', 'for-him'),
    ],
  },
  {
    id: 'for-kids',
    titleKey: 'gift_guide.categories.for_kids.title',
    descriptionKey: 'gift_guide.categories.for_kids.description',
    icon: '👶',
    products: [
      product('B0BYNLG6YM', 'Set LEGO Creativo', 'https://m.media-amazon.com/images/I/81WysBe2VKL._AC_SL1500_.jpg', '€24,99', 'for-kids'),
      product('B0B2HNLSLS', 'Gioco Educativo STEM', 'https://m.media-amazon.com/images/I/81FmUrIBYvL._AC_SL1500_.jpg', '€19,99', 'for-kids'),
      product('B08W2KM4NC', 'Set Arte e Colori', 'https://m.media-amazon.com/images/I/81j3NNNRL-L._AC_SL1500_.jpg', '€22,99', 'for-kids'),
      product('B0CB8NXCKJ', 'Peluche Interattivo', 'https://m.media-amazon.com/images/I/71z6+SY2zzL._AC_SL1500_.jpg', '€28,99', 'for-kids'),
    ],
  },
  {
    id: 'tech',
    titleKey: 'gift_guide.categories.tech.title',
    descriptionKey: 'gift_guide.categories.tech.description',
    icon: '💻',
    products: [
      product('B09JQMJHXY', 'Power Bank 20000mAh', 'https://m.media-amazon.com/images/I/71LmL6TV-3L._AC_SL1500_.jpg', '€29,99', 'tech'),
      product('B0BN3SBHZ3', 'Supporto Laptop Ergonomico', 'https://m.media-amazon.com/images/I/71+e3HCR1QL._AC_SL1500_.jpg', '€32,99', 'tech'),
      product('B0BDSTMXHC', 'Mouse Wireless Ergonomico', 'https://m.media-amazon.com/images/I/61UxfXTUyvL._AC_SL1500_.jpg', '€25,99', 'tech'),
      product('B0BC3CBLRH', 'Hub USB-C Multiporta', 'https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SL1500_.jpg', '€35,99', 'tech'),
    ],
  },
  {
    id: 'home',
    titleKey: 'gift_guide.categories.home.title',
    descriptionKey: 'gift_guide.categories.home.description',
    icon: '🏠',
    products: [
      product('B09V2NVZWS', 'Set Piante Grasse Finte', 'https://m.media-amazon.com/images/I/81AAWO4ZDQL._AC_SL1500_.jpg', '€19,99', 'home'),
      product('B0B7RYPK6X', 'Orologio da Parete Moderno', 'https://m.media-amazon.com/images/I/61qHOFoKmNL._AC_SL1500_.jpg', '€28,99', 'home'),
      product('B09W5GLPJ4', 'Set Organizer Cucina', 'https://m.media-amazon.com/images/I/71u+e8k9MvL._AC_SL1500_.jpg', '€23,99', 'home'),
      product('B0CHWPXG8F', 'Cornice Digitale WiFi', 'https://m.media-amazon.com/images/I/71D8-TJVKGL._AC_SL1500_.jpg', '€45,99', 'home'),
    ],
  },
];

// Get affiliate URL for a product
export function getProductUrl(product: CuratedProduct): string {
  return productUrlFromASIN(product.asin, product.title);
}

// Get all products flat
export function getAllProducts(): CuratedProduct[] {
  return curatedCategories.flatMap(cat => cat.products);
}

// Get products by category
export function getProductsByCategory(categoryId: string): CuratedProduct[] {
  const category = curatedCategories.find(cat => cat.id === categoryId);
  return category?.products ?? [];
}
