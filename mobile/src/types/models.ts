export interface User {
  id: number;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  phone: string;
  theme?: 'light' | 'dark';
  catalog_page_size?: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url?: string;
  images?: string[];
  extra_info?: Record<string, string>;
  category: string;
  created_at?: string;
  is_active?: boolean;
  has_discount?: boolean;
  discount_percent?: number;
  final_price?: number;
  original_price?: number;
  reviews_count?: number;
  avg_rating?: number;
}

export interface CartLine {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export interface OrderItemRow {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface OrderSummary {
  id: number;
  total: number;
  status: string;
  created_at: string;
  items: OrderItemRow[];
}

export interface ReviewableRow {
  id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  order_date: string;
  order_id: number;
  has_reviewed: boolean;
  rating?: number;
  comment?: string;
  review_id?: number;
  review_created_at?: string;
}
