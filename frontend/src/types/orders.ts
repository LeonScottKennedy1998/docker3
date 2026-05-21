import type { Order } from './product';

export interface CustomerOrderItem {
    product_id: number;
    product_name: string;
    quantity: number;
    price: number;
    total: number;
    stock?: number;
}

export interface CustomerOrderWithItems extends Omit<Order, 'items'> {
    items: CustomerOrderItem[];
}
