// Curated gift products for public Gift Guide page
// All products include affiliate-tagged Amazon URLs with verified Amazon.it ASINs

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
      product('B07V6H3BF4', 'Yankee Candle - Set Candele Votive Profumate', 'https://m.media-amazon.com/images/I/81ybG-3zDCL._AC_SL1500_.jpg', '€9,90', 'under-10'),
      product('B07CRG7BBH', 'Victorinox Classic SD - Coltellino Svizzero', 'https://m.media-amazon.com/images/I/71Wy6J2T9QL._AC_SL1500_.jpg', '€9,99', 'under-10'),
      product('B09LCJPZ1F', 'Calzini Natale Divertenti - Set 6 Paia', 'https://m.media-amazon.com/images/I/91LBD5m0bWL._AC_SL1500_.jpg', '€8,99', 'under-10'),
      product('B07D3N4LYL', 'Contigo Byron - Tazza Termica 470ml', 'https://m.media-amazon.com/images/I/61Rlp5+uHJL._AC_SL1500_.jpg', '€9,99', 'under-10'),
    ],
  },
  {
    id: 'under-20',
    titleKey: 'gift_guide.categories.under_20.title',
    descriptionKey: 'gift_guide.categories.under_20.description',
    icon: '🎁',
    products: [
      product('B0BXR2S3R3', 'Lampada Luna 3D LED 16 Colori', 'https://m.media-amazon.com/images/I/61MJMry49zL._AC_SL1500_.jpg', '€19,99', 'under-20'),
      product('B07BKRF6ZK', 'L\'Oréal Paris Revitalift - Set Cura Viso', 'https://m.media-amazon.com/images/I/71Y9Jb+BFLL._AC_SL1500_.jpg', '€17,99', 'under-20'),
      product('B0B3XWPNY7', 'Anker 313 - Caricatore Wireless 10W', 'https://m.media-amazon.com/images/I/61GpZaFEfVL._AC_SL1500_.jpg', '€15,99', 'under-20'),
      product('B00PAYHTAA', 'Moleskine - Taccuino Classico A5 Nero', 'https://m.media-amazon.com/images/I/71TZ9-3PGML._AC_SL1500_.jpg', '€16,99', 'under-20'),
    ],
  },
  {
    id: 'under-50',
    titleKey: 'gift_guide.categories.under_50.title',
    descriptionKey: 'gift_guide.categories.under_50.description',
    icon: '✨',
    products: [
      product('B09JL5B5G8', 'JBL Tune 510BT - Cuffie Bluetooth', 'https://m.media-amazon.com/images/I/61Yo4j8jx6L._AC_SL1500_.jpg', '€39,99', 'under-50'),
      product('B0BYVTB87W', 'Diffusore di Aromi 500ml con LED', 'https://m.media-amazon.com/images/I/61Yd0L8k1OL._AC_SL1500_.jpg', '€29,99', 'under-50'),
      product('B09HGV7M3R', 'Xiaomi Smart Band 7 Fitness Tracker', 'https://m.media-amazon.com/images/I/51s3VWRavxL._AC_SL1500_.jpg', '€44,99', 'under-50'),
      product('B07DW2HX9N', 'Alessi Officina - Set Caffè Moka 3 Tazze', 'https://m.media-amazon.com/images/I/61L5LqZ0WzL._AC_SL1500_.jpg', '€42,00', 'under-50'),
    ],
  },
  {
    id: 'for-her',
    titleKey: 'gift_guide.categories.for_her.title',
    descriptionKey: 'gift_guide.categories.for_her.description',
    icon: '💝',
    products: [
      product('B08NWCN7S6', 'NYX Professional Makeup - Palette Ombretti', 'https://m.media-amazon.com/images/I/71iN8x2HDUL._AC_SL1500_.jpg', '€24,99', 'for-her'),
      product('B09GFD6QDZ', 'Desigual - Borsa a Tracolla Donna', 'https://m.media-amazon.com/images/I/91yHzFxoDJL._AC_SL1500_.jpg', '€35,99', 'for-her'),
      product('B08F9MXJC9', 'Swarovski Tennis Deluxe - Bracciale', 'https://m.media-amazon.com/images/I/51wC8G8CLZL._AC_SL1500_.jpg', '€49,00', 'for-her'),
      product('B07WZ2XF2X', 'Bedsure - Plaid in Pile Morbido 150x200cm', 'https://m.media-amazon.com/images/I/91I8PKSaGqL._AC_SL1500_.jpg', '€25,99', 'for-her'),
    ],
  },
  {
    id: 'for-him',
    titleKey: 'gift_guide.categories.for_him.title',
    descriptionKey: 'gift_guide.categories.for_him.description',
    icon: '🎮',
    products: [
      product('B07MFB3QL8', 'ISNER MILE - Kit Cura Barba Professionale', 'https://m.media-amazon.com/images/I/71GRkSPUCOL._AC_SL1500_.jpg', '€26,99', 'for-him'),
      product('B07XB5QC2M', 'TEEHON - Portafoglio Uomo Pelle RFID', 'https://m.media-amazon.com/images/I/71s7C6eQMaL._AC_SL1500_.jpg', '€19,99', 'for-him'),
      product('B01LYTHP86', 'Lamicall - Supporto Tablet Scrivania', 'https://m.media-amazon.com/images/I/61JChU1+hQL._AC_SL1500_.jpg', '€14,99', 'for-him'),
      product('B07W53GFPN', 'LEATHERMAN - Pinza Multiuso Squirt PS4', 'https://m.media-amazon.com/images/I/71iB7CSTXQL._AC_SL1500_.jpg', '€44,95', 'for-him'),
    ],
  },
  {
    id: 'for-kids',
    titleKey: 'gift_guide.categories.for_kids.title',
    descriptionKey: 'gift_guide.categories.for_kids.description',
    icon: '👶',
    products: [
      product('B0BL8TTV4T', 'LEGO Icons - Set Bouquet di Fiori', 'https://m.media-amazon.com/images/I/91Ye+y8axaL._AC_SL1500_.jpg', '€49,99', 'for-kids'),
      product('B0BMQ2NSTJ', 'Clementoni - Laboratorio di Meccanica', 'https://m.media-amazon.com/images/I/91KnGZrW2XL._AC_SL1500_.jpg', '€22,90', 'for-kids'),
      product('B08BHXVMSR', 'Crayola - Valigetta Arcobaleno 140 Pezzi', 'https://m.media-amazon.com/images/I/81-d3A8PKRL._AC_SL1500_.jpg', '€24,99', 'for-kids'),
      product('B0B2R3LQFR', 'Ty Beanie Boos - Peluche Unicorno', 'https://m.media-amazon.com/images/I/71Lv52A0tnL._AC_SL1500_.jpg', '€12,99', 'for-kids'),
    ],
  },
  {
    id: 'tech',
    titleKey: 'gift_guide.categories.tech.title',
    descriptionKey: 'gift_guide.categories.tech.description',
    icon: '💻',
    products: [
      product('B0B2R7MQ1X', 'Anker PowerCore 20000mAh Power Bank', 'https://m.media-amazon.com/images/I/61DYLBsLqOL._AC_SL1500_.jpg', '€34,99', 'tech'),
      product('B08CKXWLX7', 'Amazon Basics - Supporto Laptop Alluminio', 'https://m.media-amazon.com/images/I/71h6PpGaz9L._AC_SL1500_.jpg', '€24,99', 'tech'),
      product('B07W6JG6Z7', 'Logitech Pebble M350 - Mouse Wireless', 'https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SL1500_.jpg', '€26,99', 'tech'),
      product('B0BG8V6MP8', 'UGREEN - Hub USB C 6 in 1', 'https://m.media-amazon.com/images/I/61bqbO3GSDL._AC_SL1500_.jpg', '€29,99', 'tech'),
    ],
  },
  {
    id: 'home',
    titleKey: 'gift_guide.categories.home.title',
    descriptionKey: 'gift_guide.categories.home.description',
    icon: '🏠',
    products: [
      product('B09PY12N8X', 'MyGift - Set 4 Piante Grasse Artificiali', 'https://m.media-amazon.com/images/I/81AAWO4ZDQL._AC_SL1500_.jpg', '€18,99', 'home'),
      product('B0C1JNYKKG', 'HZDHCLH - Orologio Parete Moderno Silenzioso', 'https://m.media-amazon.com/images/I/61Mv+qKpDhL._AC_SL1500_.jpg', '€25,99', 'home'),
      product('B08BZWL7VX', 'Joseph Joseph - Set Organizer Cassetti', 'https://m.media-amazon.com/images/I/71u+e8k9MvL._AC_SL1500_.jpg', '€21,00', 'home'),
      product('B0BPNGZ7JG', 'FRAMEO - Cornice Digitale WiFi 10.1"', 'https://m.media-amazon.com/images/I/71lqbLgJ1jL._AC_SL1500_.jpg', '€89,99', 'home'),
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
