// What the public API sends. Hand-written until packages/shared exists.

export interface Bundle {
  quantity: number;
  priceKes: number;
  compareAtPriceKes: number | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  prices: Bundle[];
}

export interface County {
  id: string;
  name: string;
}

export interface PlacedOrder {
  orderNo: string;
  status: string;
  totalKes: number;
  items: { productName: string; quantity: number; lineTotalKes: number }[];
}
