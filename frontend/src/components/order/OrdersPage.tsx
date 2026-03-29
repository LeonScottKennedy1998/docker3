import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Order, Product } from '../../types/product';
import { API_URLS, getAuthHeaders } from '../../config/api';
import ProductModal from '../common/ProductModal';
import './OrdersPage.css';

interface OrderItem {
    product_id: number;
    product_name: string;
    quantity: number;
    price: number;
    total: number;
    stock?: number;
}

interface EnhancedOrder extends Order {
    items: OrderItem[];
}

const OrdersPage = () => {
    const [orders, setOrders] = useState<EnhancedOrder[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<EnhancedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    
    // Фильтры
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (orders.length > 0) {
            applyFilters();
        }
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
            
            // Получаем актуальные остатки товаров для каждого заказа
            const ordersWithStock = await Promise.all(
                data.map(async (order: EnhancedOrder) => {
                    const itemsWithStock = await Promise.all(
                        (order.items || []).map(async (item: OrderItem) => {
                            try {
                                const productResponse = await fetch(API_URLS.PRODUCTS.BY_ID(item.product_id), {
                                    headers: getAuthHeaders()
                                });
                                if (productResponse.ok) {
                                    const product = await productResponse.json();
                                    return { ...item, stock: product.stock || 0 };
                                }
                            } catch (err) {
                                console.error(`Ошибка загрузки остатка для товара ${item.product_id}:`, err);
                            }
                            return { ...item, stock: 0 };
                        })
                    );
                    return { ...order, items: itemsWithStock };
                })
            );
            
            setOrders(ordersWithStock);
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

        // Фильтр по статусу
        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter);
        }

        // Фильтр по дате от
        if (dateFrom) {
            filtered = filtered.filter(order => 
                new Date(order.created_at) >= new Date(dateFrom)
            );
        }

        // Фильтр по дате до
        if (dateTo) {
            filtered = filtered.filter(order => 
                new Date(order.created_at) <= new Date(dateTo)
            );
        }

        // Фильтр по поиску (по номеру заказа или названию товара)
        if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(order => {
                // Поиск по номеру заказа
                if (order.id.toString().includes(query)) {
                    return true;
                }
                // Поиск по названиям товаров
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'В обработке': return '#f39c12';
            case 'Подтвержден': return '#27ae60';
            case 'Отменен': return '#e74c3c';
            default: return '#7f8c8d';
        }
    };

    const handleReOrder = async (order: EnhancedOrder) => {
        if (!order.items || !Array.isArray(order.items)) {
            alert('Нет товаров для повторного заказа');
            return;
        }

        // Проверяем наличие всех товаров
        const unavailableItems = order.items.filter(item => {
            return !item.stock || item.stock < 1;
        });

        if (unavailableItems.length > 0) {
            alert(`Следующие товары недоступны для повторного заказа:\n${unavailableItems.map(i => `- ${i.product_name}`).join('\n')}\n\nДобавлены только доступные товары.`);
        }

        // Фильтруем только доступные товары
        const availableItems = order.items.filter(item => item.stock && item.stock >= 1);

        if (availableItems.length === 0) {
            alert('Нет доступных товаров для повторного заказа');
            return;
        }

        // Сохраняем в localStorage для корзины
        const cartItems = availableItems.map(item => ({
            productId: item.product_id,
            name: item.product_name,
            price: item.price,
            quantity: item.quantity
        }));

        localStorage.setItem('cart', JSON.stringify(cartItems));
        
        // Обновляем корзину через событие
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartItems }));
        
        alert(`Добавлено в корзину: ${availableItems.length} товаров из ${order.items.length}`);
        
        // Перенаправляем в корзину
        window.location.href = '/cart';
    };

    const handleProductClick = async (productId: number) => {
        try {
            const response = await fetch(API_URLS.PRODUCTS.BY_ID(productId), {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки товара');
            }

            const product = await response.json();
            setSelectedProduct(product);
            setModalOpen(true);
        } catch (err) {
            console.error('Ошибка загрузки товара:', err);
            alert('Не удалось загрузить информацию о товаре');
        }
    };

    const handleAddToCartFromModal = (product: Product) => {
        const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
        const existingItem = cartItems.find((item: any) => item.productId === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cartItems.push({
                productId: product.id,
                name: product.name,
                price: product.final_price || product.price,
                quantity: 1
            });
        }
        
        localStorage.setItem('cart', JSON.stringify(cartItems));
        window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartItems }));
        alert(`${product.name} добавлен в корзину`);
        setModalOpen(false);
    };

    const handleQuickAddToCart = async (item: OrderItem) => {
        // Проверяем актуальный остаток перед добавлением
        try {
            const productResponse = await fetch(API_URLS.PRODUCTS.BY_ID(item.product_id), {
                headers: getAuthHeaders()
            });
            
            if (productResponse.ok) {
                const product = await productResponse.json();
                if (product.stock < 1) {
                    alert(`Товар "${item.product_name}" временно отсутствует на складе`);
                    return;
                }
            }
            
            const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
            const existingItem = cartItems.find((i: any) => i.productId === item.product_id);
            
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cartItems.push({
                    productId: item.product_id,
                    name: item.product_name,
                    price: item.price,
                    quantity: 1
                });
            }
            
            localStorage.setItem('cart', JSON.stringify(cartItems));
            window.dispatchEvent(new CustomEvent('cartUpdated', { detail: cartItems }));
            alert(`${item.product_name} добавлен в корзину`);
        } catch (err) {
            console.error('Ошибка добавления в корзину:', err);
            alert('Не удалось добавить товар в корзину');
        }
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
                
                {/* Фильтры */}
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
                                            🔄 Повторить заказ
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
                                                    <th>Товар</th>
                                                    <th>Количество</th>
                                                    <th>Цена</th>
                                                    <th>Сумма</th>
                                                    <th>Действия</th>
                                                </thead>
                                            <tbody>
                                                {order.items.map((item, index) => (
                                                    <tr key={index} className={(!item.stock || item.stock < 1) ? 'out-of-stock-row' : ''}>
                                                        <td data-label="Товар">
                                                            <button 
                                                                className="product-name-link"
                                                                onClick={() => handleProductClick(item.product_id)}
                                                            >
                                                                {item.product_name}
                                                            </button>
                                                            {(!item.stock || item.stock < 1) && (
                                                                <span className="unavailable-badge">нет в наличии</span>
                                                            )}
                                                        </td>
                                                        <td data-label="Количество">{item.quantity} шт.</td>
                                                        <td data-label="Цена">{item.price.toLocaleString()} ₽</td>
                                                        <td data-label="Сумма">{item.total.toLocaleString()} ₽</td>
                                                        <td data-label="Действия">
                                                            {item.stock && item.stock > 0 && (
                                                                <button 
                                                                    onClick={() => handleQuickAddToCart(item)}
                                                                    className="quick-add-btn"
                                                                >
                                                                    🛒 В корзину
                                                                </button>
                                                            )}
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

            {/* Модальное окно с товаром */}
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