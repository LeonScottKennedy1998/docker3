export interface AddToCartPayload {
    id?: number;
    productId?: number;
    name: string;
    price: number;
    quantity?: number;
    stock?: number;
    has_discount?: boolean;
    final_price?: number;
}

export interface SessionUser {
    id?: number;
    role: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    theme?: 'light' | 'dark';
    email?: string;
    [key: string]: unknown;
}
