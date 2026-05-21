import type { AddToCartPayload } from './app';

export interface WishlistPageItem {
    wishlist_id: number;
    product_id: number;
    product_name: string;
    description: string;
    price: number;
    final_price: number;
    stock: number;
    image_url: string;
    category_name: string;
    added_at: string;
    has_discount: boolean;
    discount_percent: number;
}

export interface WishlistPageProps {
    addToCart: (product: AddToCartPayload, showAlert?: boolean) => void;
}
