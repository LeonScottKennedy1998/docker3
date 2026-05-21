import type { Product } from '../types/models';
import { toFiniteNumber } from '../utils/money';

export interface OrderItemApi {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface OrderRowApi {
  id: number;
  total: number;
  status: string;
  phone: string;
  created_at: string;
  items: OrderItemApi[] | null;
}

export interface BatchProductApi {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string;
  category: string;
  has_discount?: boolean;
  discount_percent?: number;
  final_price?: number;
  original_price?: number;
  extra_info?: Record<string, string>;
  images?: string[];
}

export interface WishlistRowApi {
  product_id: number;
  product_name: string;
  description: string;
  price: string | number;
  stock: number;
  image_url?: string;
  category_name: string;
  final_price?: number;
  has_discount?: boolean;
  discount_percent?: number;
}

export function wishlistRowToProduct(row: WishlistRowApi): Product {
  const basePrice = toFiniteNumber(row.price);
  return {
    id: row.product_id,
    name: row.product_name,
    description: row.description ?? '',
    price: basePrice,
    stock: row.stock,
    image_url: row.image_url,
    category: row.category_name,
    has_discount: row.has_discount,
    discount_percent: row.discount_percent,
    final_price:
      row.final_price != null ? toFiniteNumber(row.final_price) : undefined,
    original_price: basePrice,
  };
}
