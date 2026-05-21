import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartItem, Product } from '../../types/product';
import { API_URLS, getAuthHeaders } from '../../config/api';
import ProductModal from '../common/ProductModal';
import './OrdersPage.css';
import type { CustomerOrderItem, CustomerOrderWithItems } from '../../types/orders';
import { fetchServerCart, readGuestCart, mergeCarts, persistLoggedInCart } from '../../utils/serverCart';

const OrdersPage = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<CustomerOrderWithItems[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<CustomerOrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [orders, statusFilter, dateFrom, dateTo, searchQuery]);

    const fetchOrders = async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            setError('Требуется авторизация');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(API_URLS.ORDERS.MY_ORDERS, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки заказов');
            }

            const data = await response.json();
            setOrders(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        if (!orders || orders.length === 0) {
            setFilteredOrders([]);
            return;
        }

        let filtered = [...orders];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter);
        }

        if (dateFrom) {
            filtered = filtered.filter(order => 
                new Date(order.created_at) >= new Date(dateFrom)
            );
        }

        if (dateTo) {
            filtered = filtered.filter(order => 
                new Date(order.created_at) <= new Date(dateTo)
            );
        }

        if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(order => {
                if (order.id.toString().includes(query)) return true;
                if (order.items && Array.isArray(order.items)) {
                    return order.items.some(item => 
                        item.product_name && item.product_name.toLowerCase().includes(query)
                    );
                }
                return false;
            });
        }

        setFilteredOrders(filtered);
    };

    const mergeCartWithNewProduct = useCallback(async (product: Product): Promise<CartItem[]> => {
        const token = localStorage.getItem('token');
        const rawUser = localStorage.getItem('user');
        let base: CartItem[];
        if (token && rawUser) {
            try {
                base = await fetchServerCart(token);
            } catch {
                base = readGuestCart();
            }
        } else {
            base = readGuestCart();
        }
        const existing = base.find((x) => x.productId === product.id);
        const priceRaw =
            product.has_discount && product.final_price != null ? product.final_price : product.price;
        const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);
        if (existing) {
            return base.map((x) =>
                x.productId === product.id
                    ? { ...x, quantity: x.quantity + 1, price, name: product.name }
                    : x
            );
        }
        return [
            ...base,
            {
                productId: product.id,
                name: product.name,
                price,
                quantity: 1,
            },
        ];
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'В обработке': return '#f39c12';
            case 'Подтвержден': return '#3498db';
            case 'Отменен': return '#e74c3c';
            case 'Выдан': return '#2ecc71';
            default: return '#7f8c8d';
        }
    };

    const handleReOrder = async (order: CustomerOrderWithItems) => {
        if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
            alert('Нет товаров для повторного заказа');
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Войдите в аккаунт');
            return;
        }
        try {
            const response = await fetch(API_URLS.PRODUCTS.BATCH, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productIds: order.items
                        .map((i) => i.product_id)
                        .filter((id, index, ids) => ids.indexOf(id) === index)
                })
            });
            if (!response.ok) throw new Error('batch');
            const products: Product[] = await response.json();
            const byId = new Map(products.map((p) => [p.id, p]));
            const skipped: string[] = [];
            const cartItems: { productId: number; name: string; price: number; quantity: number }[] = [];
            for (const item of order.items) {
                const p = byId.get(item.product_id);
                if (!p || p.stock <= 0) {
                    skipped.push(item.product_name);
                    continue;
                }
                const qty = Math.min(item.quantity, p.stock);
                const price =
                    p.has_discount && p.final_price != null ? p.final_price : p.price;
                cartItems.push({
                    productId: p.id,
                    name: p.name,
                    price: typeof price === 'number' ? price : Number(price),
                    quantity: qty
                });
            }
            if (cartItems.length === 0) {
                alert(
                    skipped.length
                        ? `Нет в наличии или снято с продажи: ${skipped.join(', ')}`
                        : 'Не удалось добавить товары'
                );
                return;
            }
            const server = await fetchServerCart(token);
            const merged = mergeCarts(server, cartItems);
            const saved = await persistLoggedInCart(token, merged);
            window.dispatchEvent(new CustomEvent('cartUpdated', { detail: saved }));
            if (skipped.length > 0) {
                alert(`Часть товаров недоступна: ${skipped.join(', ')}. Остальное добавлено в корзину.`);
            } else {
                alert(`Добавлено позиций: ${cartItems.length}`);
            }
            navigate('/cart');
        } catch {
            alert('Не удалось проверить наличие товаров');
        }
    };

    const handleProductClick = async (productId: number) => {
        try {
            const response = await fetch(API_URLS.PRODUCTS.BY_ID(productId), {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Ошибка загрузки товара');

            const product = await response.json();
            setSelectedProduct(product);
            setModalOpen(true);
        } catch (err) {
            console.error('Ошибка:', err);
            alert('Не удалось загрузить товар');
        }
    };

    const handleAddToCartFromModal = async (product: Product) => {
        let cartItems = await mergeCartWithNewProduct(product);
        const token = localStorage.getItem('token');
        if (token) {
            try {
                cartItems = await persistLoggedInCart(token, cartItems);
            } catch {
                /* оставить локальный merge; синк сработает из App.tsx */
            }
        }
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartItems }));
        alert(`${product.name} добавлен в корзину`);
        setModalOpen(false);
    };

    const clearFilters = () => {
        setStatusFilter('all');
        setDateFrom('');
        setDateTo('');
        setSearchQuery('');
    };

    if (loading) {
        return (
            <div className="orders-page">
                <div className="page">
                    <h1>Мои заказы</h1>
                    <div className="loading">Загрузка заказов...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="orders-page">
                <div className="page">
                    <h1>Мои заказы</h1>
                    <div className="error-message">{error}</div>
                </div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="orders-page">
                <div className="page">
                    <h1>Мои заказы</h1>
                    <div className="empty-orders">
                        <p>У вас пока нет заказов</p>
                        <Link to="/catalog">
                            <button className="cta-button">Перейти к каталогу</button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="orders-page">
            <div className="page">
                <h1>Мои заказы</h1>

                <div className="orders-filters">
                    <div className="filters-row">
                        <div className="filter-group">
                            <label>Статус:</label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">Все</option>
                                <option value="В обработке">В обработке</option>
                                <option value="Подтвержден">Подтвержден</option>
                                <option value="Отменен">Отменен</option>
                                <option value="Выдан">Выдан</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>Дата от:</label>
                            <input 
                                type="date" 
                                value={dateFrom} 
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="filter-date"
                            />
                        </div>

                        <div className="filter-group">
                            <label>Дата до:</label>
                            <input 
                                type="date" 
                                value={dateTo} 
                                onChange={(e) => setDateTo(e.target.value)}
                                className="filter-date"
                            />
                        </div>

                        <div className="filter-group search-group">
                            <label>Поиск:</label>
                            <input 
                                type="text" 
                                placeholder="№ заказа или товар..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="filter-search"
                            />
                        </div>

                        <button onClick={clearFilters} className="clear-filters-btn">
                            Сбросить
                        </button>
                    </div>
                    
                    <div className="filter-stats">
                        Найдено: {filteredOrders.length} заказов
                        {filteredOrders.length !== orders.length && (
                            <span> (всего {orders.length})</span>
                        )}
                    </div>
                </div>
                
                <div className="orders-list">
                    {filteredOrders.map(order => (
                        <div key={order.id} className="order-card">
                            <div className="order-header">
                                <div>
                                    <h3>Заказ #{order.id}</h3>
                                    <p className="order-date">
                                        {new Date(order.created_at).toLocaleDateString('ru-RU', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <div className="order-header-right">
                                    <div className="order-status">
                                        <span 
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(order.status) }}
                                        >
                                            {order.status}
                                        </span>
                                    </div>
                                    {order.status !== 'Отменен' && order.items && order.items.length > 0 && (
                                        <button 
                                            onClick={() => handleReOrder(order)}
                                            className="reorder-btn"
                                            title="Повторить заказ"
                                        >
                                            🔄 Повторить
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="order-items">
                                <h4>Состав заказа:</h4>
                                {order.items && order.items.length > 0 ? (
                                    <div className="table-wrapper">
                                        <table className="order-items-table">
                                            <thead>
                                                <tr>
                                                    <th>Товар</th>
                                                    <th>Кол-во</th>
                                                    <th>Цена</th>
                                                    <th>Сумма</th>
                                                    <th>Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td data-label="Товар">
                                                            <button 
                                                                className="product-name-link"
                                                                onClick={() => handleProductClick(item.product_id)}
                                                            >
                                                                {item.product_name}
                                                            </button>
                                                        </td>
                                                        <td data-label="Кол-во">{item.quantity} шт.</td>
                                                        <td data-label="Цена">{item.price.toLocaleString()} ₽</td>
                                                        <td data-label="Сумма">{item.total.toLocaleString()} ₽</td>
                                                        <td data-label="Действия">
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    void (async () => {
                                                                        try {
                                                                            const r = await fetch(
                                                                                API_URLS.PRODUCTS.BY_ID(item.product_id),
                                                                                { headers: getAuthHeaders() }
                                                                            );
                                                                            if (!r.ok) throw new Error();
                                                                            const p: Product = await r.json();
                                                                            if (typeof p.stock === 'number' && p.stock <= 0) {
                                                                                alert('Товар закончился');
                                                                                return;
                                                                            }
                                                                            let cartItems = await mergeCartWithNewProduct(p);
                                                                            const tk = localStorage.getItem('token');
                                                                            if (tk) {
                                                                                try {
                                                                                    cartItems = await persistLoggedInCart(tk, cartItems);
                                                                                } catch {
                                                                                    /* см. модалку */
                                                                                }
                                                                            }
                                                                            window.dispatchEvent(
                                                                                new CustomEvent('cartUpdated', {
                                                                                    detail: cartItems
                                                                                })
                                                                            );
                                                                            alert(`${item.product_name} добавлен в корзину`);
                                                                            navigate('/cart');
                                                                        } catch {
                                                                            alert('Не удалось загрузить товар');
                                                                        }
                                                                    })();
                                                                }}
                                                                className="quick-add-btn"
                                                            >
                                                                🛒 В корзину
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="no-items-message">Нет товаров в заказе</p>
                                )}
                            </div>
                            
                            <div className="order-footer">
                                <div className="order-total">
                                    <strong>Итого:</strong>
                                    <span className="total-amount">{order.total.toLocaleString()} ₽</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredOrders.length === 0 && (
                    <div className="empty-orders">
                        <p>По выбранным фильтрам заказов не найдено</p>
                        <button onClick={clearFilters} className="secondary-btn">
                            Сбросить фильтры
                        </button>
                    </div>
                )}
            </div>

            <ProductModal
                product={selectedProduct}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onAddToCart={handleAddToCartFromModal}
            />
        </div>
    );
};

export default OrdersPage;