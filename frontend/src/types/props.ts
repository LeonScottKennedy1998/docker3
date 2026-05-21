import type { SessionUser } from './app';
import type { CartItem } from './product';
import type { Product } from './product';

export interface HomePageProps {
    user: SessionUser | null;
    onLogout: () => void;
}

export interface LoginPageProps {
    onLogin: (userData: SessionUser) => void | Promise<void>;
}

export interface CartPageProps {
    cart: CartItem[];
    updateCart: (cart: CartItem[]) => void;
    clearCart: () => void;
    removeFromCart: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    user: SessionUser | null;
}

export interface ProductCardProps {
    product: Product;
    showWishlistButton?: boolean;
    showAddToCartButton?: boolean;
    showCategory?: boolean;
    showDescription?: boolean;
    onAddToCart?: (product: Product) => void;
    onViewDetails?: (product: Product) => void;
    onToggleWishlist?: (productId: number, isInWishlist: boolean) => Promise<void>;
    isInWishlist?: boolean;
    className?: string;
    layout?: 'grid' | 'list';
    showAlert?: boolean;
}

export interface ProductModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (product: Product) => void;
}

export interface ReviewsModalProps {
    productId: number;
    productName: string;
    onClose: () => void;
}

export interface StarRatingProps {
    rating: number;
    onRatingChange?: (rating: number) => void;
    readonly?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export interface ThemeRouteSyncProps {
    user: SessionUser | null;
}

export interface AdminDashboardProps {
    defaultTab?: 'users' | 'audit' | 'backup' | 'performance';
}

export interface MerchandiserDashboardProps {
    defaultTab?: 'products' | 'orders' | 'analytics';
}

export interface ProcurementDashboardProps {
    defaultTab?: 'suppliers' | 'orders' | 'stock';
}

export interface UserProfile {
    id: number;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    patronymic: string;
    phone: string;
    is_active: boolean;
    created_at: string;
    theme?: 'light' | 'dark';
    catalog_page_size?: number;
}
