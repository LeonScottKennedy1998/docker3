export interface MerchandiserOrder {
    id: number;
    total: number;
    status: string;
    phone: string;
    created_at: string;
    updated_at: string;
    customer_name: string;
    customer_email: string;
    items_count: number;
}

export interface MerchandiserOrderLineItem {
    id: number;
    product_id: number;
    name: string;
    description: string;
    quantity: number;
    price: number;
    total: number;
}

export interface MerchandiserOrderDetails extends MerchandiserOrder {
    items: MerchandiserOrderLineItem[];
    customer_phone?: string;
}

export interface MerchandiserOrderStatus {
    id: number;
    name: string;
}

export interface ProductFormData {
    name: string;
    description: string;
    price: string;
    category_id: string;
    is_active: boolean;
    stock: string;
}

export interface ProductExtraPair {
    key: string;
    value: string;
}

export interface CategoryFormData {
    category_name: string;
    description: string;
}

export interface ProcurementInlineStarRatingProps {
    value: number;
    onChange?: (rating: number) => void;
    readonly?: boolean;
    size?: 'small' | 'medium' | 'large';
}
