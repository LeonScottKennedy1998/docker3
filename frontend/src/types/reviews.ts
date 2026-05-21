export type MyReviewsTabId = 'pending' | 'reviewed';
export type MyReviewsSortOrder = 'desc' | 'asc';

export interface ReviewableProduct {
    id: number;
    name: string;
    description: string;
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
    review_updated_at?: string;
}

export interface MyReviewsFilterState {
    sort: MyReviewsSortOrder;
    dateFrom: string;
    dateTo: string;
}
