import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ProcurementDashboard.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type {
    DeliveryStatus,
    ProcurementShortProduct,
    PurchaseOrder,
    Supplier,
} from '../../types/procurement';
import type { ProcurementInlineStarRatingProps } from '../../types/merchandiser';

const StarRating = ({
    value,
    onChange,
    readonly = false,
    size = 'medium',
}: ProcurementInlineStarRatingProps) => {
    const [hover, setHover] = useState(0);
    
    const getStarSize = () => {
        switch(size) {
            case 'small': return '18px';
            case 'large': return '32px';
            default: return '24px';
        }
    };
    
    const starStyle = {
        fontSize: getStarSize(),
        cursor: readonly ? 'default' : 'pointer',
        color: '#ffc107',
        transition: 'all 0.2s'
    };
    
    return (
        <div className="star-rating" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    style={{
                        ...starStyle,
                        opacity: (hover || value) >= star ? 1 : 0.4,
                        transform: hover >= star ? 'scale(1.1)' : 'scale(1)',
                        textShadow: (hover || value) >= star ? '0 0 5px rgba(255, 193, 7, 0.5)' : 'none'
                    }}
                    onClick={() => !readonly && onChange && onChange(star)}
                    onMouseEnter={() => !readonly && setHover(star)}
                    onMouseLeave={() => !readonly && setHover(0)}
                >
                    ★
                </span>
            ))}
            {!readonly && value > 0 && (
                <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.9rem' }}>
                    {value} из 5
                </span>
            )}
            {readonly && value > 0 && (
                <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.9rem' }}>
                    {value.toFixed(1)}/5
                </span>
            )}
        </div>
    );
};

const OrderManagement = () => {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [statuses, setStatuses] = useState<DeliveryStatus[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<ProcurementShortProduct[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState({
        orders: true,
        products: true,
        data: true
    });
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [ratingModal, setRatingModal] = useState<{
        show: boolean;
        poId: number;
        supplierName: string;
        currentRating: number;
    } | null>(null);
    
    const [newOrder, setNewOrder] = useState({
        supplier_id: '',
        items: [] as Array<{ product_id: number; quantity: number; unit_price: number; name: string }>
    });

    const [newItem, setNewItem] = useState({
        product_id: '',
        quantity: 1,
        unit_price: 0
    });

    const [archiveView, setArchiveView] = useState<'active' | 'archive'>('active');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

    const [selectedPoIds, setSelectedPoIds] = useState<number[]>([]);
    const [bulkTargetStatus, setBulkTargetStatus] = useState('');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Токен не найден');
            setLoading(prev => ({ ...prev, orders: false, data: false }));
            return;
        }

        try {
            const ordersUrl = API_URLS.PROCUREMENT.ORDERS_QUERY({
                archive: archiveView === 'archive',
                statusId: statusFilter === 'all' ? undefined : statusFilter,
            });

            const [ordersRes, statusesRes, suppliersRes] = await Promise.all([
                fetch(ordersUrl, {
                    headers: getAuthHeaders(),
                }),
                fetch(API_URLS.PROCUREMENT.DELIVERY_STATUSES, {
                    headers: getAuthHeaders(),
                }),
                fetch(API_URLS.PROCUREMENT.SUPPLIERS, {
                    headers: getAuthHeaders(),
                }),
            ]);

            if (!ordersRes.ok || !statusesRes.ok || !suppliersRes.ok) {
                throw new Error('Ошибка загрузки данных');
            }

            const ordersData = await ordersRes.json();
            const statusesData = await statusesRes.json();
            const suppliersData = await suppliersRes.json();

            setOrders(Array.isArray(ordersData) ? ordersData : []);
            setStatuses(Array.isArray(statusesData) ? statusesData : []);
            setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
            setSelectedPoIds([]);
            setBulkTargetStatus('');

            setLoading(prev => ({ ...prev, orders: false }));
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            setOrders([]);
            setStatuses([]);
            setSuppliers([]);
            setSelectedPoIds([]);
            setBulkTargetStatus('');
            setLoading(prev => ({ ...prev, orders: false }));
        }
    }, [archiveView, statusFilter]);

    const fetchProducts = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Токен не найден');
            setLoading(prev => ({ ...prev, products: false, data: false }));
            return;
        }
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.BASE, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Ответ от API продуктов:', data);
            
            if (Array.isArray(data)) {
                setProducts(data);
            } else if (data && Array.isArray(data.products)) {
                setProducts(data.products);
            } else if (data && data.data && Array.isArray(data.data)) {
                setProducts(data.data);
            } else {
                console.warn('Неожиданный формат данных товаров:', data);
                setProducts([]);
            }
            
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            setProducts([]);
        } finally {
            setLoading(prev => ({ ...prev, products: false }));
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setSelectedOrder(null);
    }, [archiveView, statusFilter]);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (!loading.orders && !loading.products) {
            setLoading(prev => ({ ...prev, data: false }));
        }
    }, [loading.orders, loading.products]);

    const fetchOrderDetails = async (poId: number) => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Токен не найден');
            return;
        }
        
        try {
            const response = await fetch(API_URLS.PROCUREMENT.ORDER_BY_ID(poId), {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setOrderDetails(data);
        } catch (error) {
            console.error('Ошибка загрузки деталей:', error);
            setOrderDetails(null);
        }
    };

    const handleSelectOrder = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        fetchOrderDetails(order.po_id);
    };

    const handleUpdateStatus = async (
        poId: number,
        statusId: number,
        rating?: number,
        options?: { quiet?: boolean; skipSpinner?: boolean; rethrow?: boolean }
    ) => {
        const { quiet = false, skipSpinner = false, rethrow = false } = options || {};

        if (!skipSpinner && updatingStatus === poId) return;

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Токен не найден. Пожалуйста, войдите в систему.');
            return;
        }
        
        if (!skipSpinner) setUpdatingStatus(poId);
        
        try {
            const body: any = { delivery_status_id: statusId };
            if (rating) {
                body.rating = rating;
            }
            
            const response = await fetch(API_URLS.PROCUREMENT.UPDATE_ORDER_STATUS(poId), {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка обновления статуса');
            }
            
            const result = await response.json();
            
            setOrders(prevOrders => 
                prevOrders.map(order => 
                    order.po_id === poId 
                        ? { 
                            ...order, 
                            delivery_status_id: statusId,
                            status_name: statuses.find(s => s.status_id === statusId)?.status_name || order.status_name 
                        } 
                        : order
                )
            );
            
            if (!quiet) {
                if (statusId === 4 && rating) {
                    alert(`✅ Заявка получена!\n⭐ Поставщику выставлена оценка: ${rating}/5`);
                } else if (statusId === 4) {
                    alert(`✅ Заявка получена без оценки`);
                } else {
                    alert(result.message || 'Статус обновлен');
                }
            }
            
            if (selectedOrder?.po_id === poId) {
                setSelectedOrder(prev => prev ? {
                    ...prev,
                    delivery_status_id: statusId,
                    status_name: statuses.find(s => s.status_id === statusId)?.status_name || prev.status_name
                } : null);
                
                fetchOrderDetails(poId);
            }
            
        } catch (error: any) {
            console.error('Ошибка обновления статуса:', error);
            alert(error.message || 'Ошибка обновления статуса');
            if (rethrow) throw error;
        } finally {
            if (!skipSpinner) setUpdatingStatus(null);
        }
    };

    const handleRatingSubmit = async () => {
        if (!ratingModal) return;
        
        if (ratingModal.currentRating === 0) {
            alert('Пожалуйста, поставьте оценку поставщику');
            return;
        }
        
        const modalData = { ...ratingModal };
        setRatingModal(null);
        
        await handleUpdateStatus(
            modalData.poId, 
            4, 
            modalData.currentRating
        );
    };

    const handleSkipRating = async () => {
        if (!ratingModal) return;
        
        const modalData = { ...ratingModal };
        setRatingModal(null);
        
        await handleUpdateStatus(modalData.poId, 4);
    };

    const applyQuickOrder = () => {
        const quickOrderData = localStorage.getItem('quickOrderData');
        if (!quickOrderData) {
            alert('Нет товара для быстрого заказа');
            return;
        }
        
        try {
            const data = JSON.parse(quickOrderData);
            const product = products.find(p => p.id === data.product_id);
            if (product) {
                setNewOrder({
                    supplier_id: '',
                    items: [{
                        product_id: data.product_id,
                        quantity: data.recommended_qty || 1,
                        unit_price: data.price || product.price,
                        name: data.product_name || product.name
                    }]
                });
                
                setShowCreateForm(true);
                
                localStorage.removeItem('quickOrderData');
                
                alert(`✅ Товар "${data.product_name}" добавлен в заявку!\n\nКоличество: ${data.recommended_qty || 1} шт.\nТеперь выберите поставщика.`);
            } else {
                alert('Товар не найден в базе данных');
                localStorage.removeItem('quickOrderData');
            }
        } catch (error) {
            console.error('Ошибка загрузки быстрого заказа:', error);
            alert('Ошибка загрузки быстрого заказа');
            localStorage.removeItem('quickOrderData');
        }
    };

    const handleAddItem = () => {
        if (!Array.isArray(products) || products.length === 0) {
            alert('Список товаров не загружен');
            return;
        }
        
        const productId = parseInt(newItem.product_id);
        if (isNaN(productId)) {
            alert('Выберите товар');
            return;
        }
        
        const product = products.find(p => p.id === productId);
        if (!product) {
            alert('Товар не найден');
            return;
        }
        
        setNewOrder({
            ...newOrder,
            items: [
                ...newOrder.items,
                {
                    product_id: productId,
                    quantity: newItem.quantity,
                    unit_price: newItem.unit_price || product.price,
                    name: product.name
                }
            ]
        });
        
        setNewItem({
            product_id: '',
            quantity: 1,
            unit_price: 0
        });
    };

    const handleRemoveItem = (index: number) => {
        const itemName = newOrder.items[index].name;
        
        if (window.confirm(`Удалить товар "${itemName}" из заявки?`)) {
            setNewOrder({
                ...newOrder,
                items: newOrder.items.filter((_, i) => i !== index)
            });
        }
    };

    const handleCreateOrder = async () => {
        if (!newOrder.supplier_id || newOrder.items.length === 0) {
            alert('Выберите поставщика и добавьте товары');
            return;
        }
        
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Токен не найден. Пожалуйста, войдите в систему.');
            return;
        }
        
        try {
            const response = await fetch(API_URLS.PROCUREMENT.ORDERS, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    supplier_id: parseInt(newOrder.supplier_id),
                    items: newOrder.items.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price
                    }))
                })
            });
            
            if (response.ok) {
                alert('Заявка создана успешно!');
                setShowCreateForm(false);
                setNewOrder({
                    supplier_id: '',
                    items: []
                });
                fetchData();
            } else {
                const error = await response.json();
                alert(error.error || 'Ошибка создания заявки');
            }
        } catch (error) {
            alert('Ошибка создания заявки');
        }
    };

    const getStatusColor = (statusId: number) => {
        const colors: {[key: number]: string} = {
            1: '#f39c12',
            2: '#3498db',
            3: '#9b59b6',
            4: '#2ecc71',
            5: '#e74c3c'
        };
        return colors[statusId] || '#95a5a6';
    };

    const getStatusName = (statusId: number) => {
        const status = statuses.find(s => s.status_id === statusId);
        return status ? status.status_name : 'Неизвестно';
    };

    const shortNextPurchaseLabel = (statusId: number) => {
        const short: Record<number, string> = {
            2: 'Подтвердить',
            3: 'В пути',
            4: 'Получено',
            5: 'Отменить'
        };
        return short[statusId] ?? getStatusName(statusId);
    };

    const getAllowedNextPurchaseStatusIds = (statusId: number): number[] => {
        switch (statusId) {
            case 1:
                return [2, 5];
            case 2:
                return [3];
            case 3:
                return [4];
            default:
                return [];
        }
    };

    const onPurchaseStatusAction = (order: PurchaseOrder, newStatusId: number) => {
        if (newStatusId === 4) {
            setRatingModal({
                show: true,
                poId: order.po_id,
                supplierName: order.supplier_name,
                currentRating: 0
            });
        } else {
            handleUpdateStatus(order.po_id, newStatusId);
        }
    };

    const bulkNextPurchaseStatusIds = useMemo(() => {
        const selected = orders.filter(o => selectedPoIds.includes(o.po_id));
        if (selected.length === 0) return [];
        const st = selected[0].delivery_status_id;
        if (!selected.every(o => o.delivery_status_id === st)) return [];
        return getAllowedNextPurchaseStatusIds(st);
    }, [orders, selectedPoIds]);

    const selectAllPurchaseOrdersOnScreen = () => {
        if (!Array.isArray(orders) || orders.length === 0) return;
        if (selectedPoIds.length === orders.length) {
            setSelectedPoIds([]);
        } else {
            setSelectedPoIds(orders.map(o => o.po_id));
        }
    };

    const bulkApplyPurchaseStatus = async () => {
        const target = parseInt(bulkTargetStatus, 10);
        if (Number.isNaN(target) || selectedPoIds.length === 0) return;
        if (target === 4) {
            const ok = window.confirm(
                `Отметить полученными без оценки поставщика заявок: ${selectedPoIds.length}?`
            );
            if (!ok) return;
        }
        setBulkSubmitting(true);
        try {
            for (const poId of selectedPoIds) {
                await handleUpdateStatus(poId, target, undefined, {
                    quiet: true,
                    skipSpinner: true,
                    rethrow: true
                });
            }
            alert(`Статус обновлён для заявок: ${selectedPoIds.length}`);
            setSelectedPoIds([]);
            setBulkTargetStatus('');
            await fetchData();
        } catch {
        } finally {
            setBulkSubmitting(false);
        }
    };

    const activeSuppliers = Array.isArray(suppliers) 
        ? suppliers.filter(s => s.is_active !== false)
        : [];

    const purchaseListTitle =
        archiveView === 'archive'
            ? 'Архив заявок (старше 30 дней)'
            : 'Актуальные заявки (последние 30 дней)';

    if (loading.data) return <div className="loading">Загрузка данных...</div>;

    return (
        <div className="order-management">
            <div className="section-header">
                <h2>Управление заявками на закупку</h2>
                <div className="header-actions">
                    <button onClick={() => setShowCreateForm(true)} className="cta-button">
                        <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>+</span>
                        Создать заявку
                    </button>
                    
                    <button 
                        onClick={applyQuickOrder}
                        className="secondary-btn"
                        title="Добавить товар из быстрого заказа"
                        disabled={!localStorage.getItem('quickOrderData')}
                    >
                        <span style={{ fontSize: '1.2rem' }}>🚚</span>
                        Быстрый заказ
                    </button>

                    <div className="orders-viewmode-toggle" role="group" aria-label="Вид списка заявок">
                        <span className="viewmode-label">Вид:</span>
                        <button
                            type="button"
                            className={`viewmode-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            Таблица
                        </button>
                        <button
                            type="button"
                            className={`viewmode-btn ${viewMode === 'cards' ? 'active' : ''}`}
                            onClick={() => setViewMode('cards')}
                        >
                            Карточки
                        </button>
                    </div>
                </div>
            </div>

            <div className="orders-view-tabs">
                <button
                    type="button"
                    className={`tab-btn ${archiveView === 'active' ? 'active' : ''}`}
                    onClick={() => {
                        setArchiveView('active');
                        setSelectedOrder(null);
                    }}
                >
                    Актуальные
                </button>
                <button
                    type="button"
                    className={`tab-btn ${archiveView === 'archive' ? 'active' : ''}`}
                    onClick={() => {
                        setArchiveView('archive');
                        setSelectedOrder(null);
                    }}
                >
                    Архив
                </button>
            </div>
            <p className="orders-archive-hint">
                В списке «Актуальные» — заявки не старше 30 дней с даты создания. Более старые заявки — во вкладке
                «Архив».
            </p>
            <div className="procurement-orders-toolbar-row">
                <div className="filter-controls">
                    <span>Фильтр по статусу:</span>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="status-filter"
                    >
                        <option value="all">Все статусы</option>
                        {statuses.map(s => (
                            <option key={s.status_id} value={String(s.status_id)}>
                                {s.status_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedPoIds.length > 0 && (
                <div className="orders-bulk-bar procurement-bulk-bar">
                    <span>
                        Выбрано: <strong>{selectedPoIds.length}</strong>
                    </span>
                    <button
                        type="button"
                        className="link-like-btn"
                        onClick={selectAllPurchaseOrdersOnScreen}
                    >
                        {Array.isArray(orders) && selectedPoIds.length === orders.length
                            ? 'Снять выделение'
                            : 'Выделить все на экране'}
                    </button>
                    {bulkNextPurchaseStatusIds.length > 0 ? (
                        <>
                            <select
                                value={bulkTargetStatus}
                                onChange={e => setBulkTargetStatus(e.target.value)}
                                className="inline-status-select bulk-status-select"
                            >
                                <option value="">Массово перевести в…</option>
                                {bulkNextPurchaseStatusIds.map(sid => (
                                    <option key={sid} value={String(sid)}>
                                        → {getStatusName(sid)}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="cta-button small"
                                disabled={!bulkTargetStatus || bulkSubmitting}
                                onClick={bulkApplyPurchaseStatus}
                            >
                                {bulkSubmitting ? '…' : 'Применить'}
                            </button>
                        </>
                    ) : (
                        <span className="bulk-hint-warn">
                            {(() => {
                                const sel = orders.filter(o => selectedPoIds.includes(o.po_id));
                                const mixed =
                                    sel.length > 1 &&
                                    !sel.every(o => o.delivery_status_id === sel[0].delivery_status_id);
                                if (mixed) {
                                    return 'Выберите заявки с одинаковым статусом для массовой смены.';
                                }
                                return 'Для выбранных заявок нет доступных переходов.';
                            })()}
                        </span>
                    )}
                </div>
            )}

            <div className="orders-container">
                <div className={`orders-sidebar ${viewMode === 'table' ? 'orders-sidebar--purchase-table' : ''}`}>
                    <h3>
                        {purchaseListTitle} ({Array.isArray(orders) ? orders.length : 0})
                    </h3>
                    {viewMode === 'cards' ? (
                        <div className="orders-list">
                            {Array.isArray(orders) && orders.length > 0 ? (
                                orders.map(order => (
                                    <div 
                                        key={order.po_id}
                                        className={`order-item ${selectedOrder?.po_id === order.po_id ? 'selected' : ''}`}
                                        onClick={() => handleSelectOrder(order)}
                                    >
                                        <div className="order-item-header">
                                            <label
                                                className="order-checkbox-wrap"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPoIds.includes(order.po_id)}
                                                    onChange={() =>
                                                        setSelectedPoIds(prev =>
                                                            prev.includes(order.po_id)
                                                                ? prev.filter(id => id !== order.po_id)
                                                                : [...prev, order.po_id]
                                                        )
                                                    }
                                                />
                                            </label>
                                            <div className="order-item-header-main">
                                                <span className="order-id">Заявка #{order.po_id}</span>
                                                <span
                                                    className="status-badge"
                                                    style={{
                                                        backgroundColor: getStatusColor(order.delivery_status_id)
                                                    }}
                                                >
                                                    {order.status_name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="order-item-details">
                                            <p><strong>Поставщик:</strong> {order.supplier_name}</p>
                                            <p><strong>Сумма:</strong> {order.total_amount?.toLocaleString()} ₽</p>
                                            <p><strong>Товаров:</strong> {order.items_count}</p>
                                            <p className="order-date">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <p>Заявок не найдено</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="purchase-table-scroll">
                            {Array.isArray(orders) && orders.length > 0 ? (
                                <table className="purchase-orders-data-table">
                                    <thead>
                                        <tr>
                                            <th className="col-check" />
                                            <th>№</th>
                                            <th>Дата</th>
                                            <th>Поставщик</th>
                                            <th>Сумма</th>
                                            <th>Поз.</th>
                                            <th>Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(order => (
                                            <tr
                                                key={order.po_id}
                                                className={selectedOrder?.po_id === order.po_id ? 'row-selected' : ''}
                                                onClick={() => handleSelectOrder(order)}
                                            >
                                                <td
                                                    className="col-check"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPoIds.includes(order.po_id)}
                                                        onChange={() =>
                                                            setSelectedPoIds(prev =>
                                                                prev.includes(order.po_id)
                                                                    ? prev.filter(id => id !== order.po_id)
                                                                    : [...prev, order.po_id]
                                                            )
                                                        }
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="mono">#{order.po_id}</td>
                                                <td className="nowrap">
                                                    {new Date(order.created_at).toLocaleDateString('ru-RU')}
                                                </td>
                                                <td className="td-supplier">
                                                    <span className="td-name">{order.supplier_name}</span>
                                                </td>
                                                <td>{order.total_amount?.toLocaleString()} ₽</td>
                                                <td>{order.items_count}</td>
                                                <td>
                                                    <span
                                                        className="status-badge table-badge"
                                                        style={{ backgroundColor: getStatusColor(order.delivery_status_id) }}
                                                    >
                                                        {order.status_name}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <p>Заявок не найдено</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="order-details-panel">
                    {selectedOrder ? (
                        <>
                            <div className="order-details-header">
                                <div>
                                    <h2>Заявка #{selectedOrder.po_id}</h2>
                                    <p className="customer-info">
                                        Поставщик: {selectedOrder.supplier_name}
                                    </p>
                                    <p className="status-now-line">
                                        Текущий статус:{' '}
                                        <span
                                            className="status-badge table-badge"
                                            style={{ backgroundColor: getStatusColor(selectedOrder.delivery_status_id) }}
                                        >
                                            {getStatusName(selectedOrder.delivery_status_id)}
                                        </span>
                                    </p>
                                    <p>Дата создания: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                </div>
                                <div className="order-actions">
                                    <button
                                        type="button"
                                        className="call-btn"
                                        onClick={() => window.open(`tel:${selectedOrder.supplier_phone}`)}
                                    >
                                        📞 {selectedOrder.supplier_phone}
                                    </button>

                                    <div className="single-status-change">
                                        <span className="single-status-label">Изменить статус</span>
                                        {getAllowedNextPurchaseStatusIds(selectedOrder.delivery_status_id).length > 0 ? (
                                            <>
                                                <div className="status-quick-buttons">
                                                    {getAllowedNextPurchaseStatusIds(selectedOrder.delivery_status_id).map(sid => (
                                                        <button
                                                            key={sid}
                                                            type="button"
                                                            className="status-quick-btn"
                                                            style={{ borderColor: getStatusColor(sid) }}
                                                            disabled={updatingStatus === selectedOrder.po_id}
                                                            onClick={() => onPurchaseStatusAction(selectedOrder, sid)}
                                                        >
                                                            → {shortNextPurchaseLabel(sid)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="no-inline-action">Финальный статус — смена недоступна</span>
                                        )}
                                        {updatingStatus === selectedOrder.po_id && (
                                            <span className="updating-indicator">🔄</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {orderDetails ? (
                                <>
                                    <div className="order-info-grid">
                                        <div className="info-card">
                                            <h4>Информация о поставщике</h4>
                                            <p><strong>Компания:</strong> {orderDetails.order?.supplier_name || selectedOrder.supplier_name}</p>
                                            <p><strong>Контактное лицо:</strong> {orderDetails.order?.contact_person || selectedOrder.contact_person}</p>
                                            <p><strong>Email:</strong> {orderDetails.order?.supplier_email || 'Нет данных'}</p>
                                            <p><strong>Телефон:</strong> {orderDetails.order?.supplier_phone || selectedOrder.supplier_phone}</p>
                                            <p><strong>Менеджер:</strong> {orderDetails.order?.manager_name || 'Нет данных'}</p>
                                        </div>

                                        <div className="info-card">
                                            <h4>Детали заявки</h4>
                                            <p><strong>Общая сумма:</strong> {orderDetails.order?.total_amount?.toLocaleString() || selectedOrder.total_amount?.toLocaleString()} ₽</p>
                                            <p><strong>Статус:</strong> 
                                                <span 
                                                    className="status-badge-inline"
                                                    style={{ 
                                                        backgroundColor: getStatusColor(selectedOrder.delivery_status_id),
                                                        marginLeft: '8px'
                                                    }}
                                                >
                                                    {getStatusName(selectedOrder.delivery_status_id)}
                                                </span>
                                            </p>
                                            <p><strong>Создана:</strong> {new Date(orderDetails.order?.created_at || selectedOrder.created_at).toLocaleString()}</p>
                                            <p><strong>Обновлена:</strong> {new Date(orderDetails.order?.updated_at || selectedOrder.updated_at).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {orderDetails.order?.supplier_rating !== undefined && (
                                        <div className="supplier-rating-card">
                                            <h4>⭐ Рейтинг поставщика</h4>
                                            <StarRating 
                                                value={orderDetails.order.supplier_rating || 0} 
                                                readonly={true}
                                                size="large"
                                            />
                                            <p className="rating-info">
                                                На основе всех выполненных заказов
                                            </p>
                                        </div>
                                    )}

                                    <div className="order-items-card">
                                        <h4>Товары в заявке ({orderDetails.items?.length || selectedOrder.items_count || 0})</h4>
                                        {orderDetails.items && Array.isArray(orderDetails.items) ? (
                                            <table className="order-items-table">
                                                <thead>
                                                    <tr>
                                                        <th>Товар</th>
                                                        <th>Категория</th>
                                                        <th>Количество</th>
                                                        <th>Цена за единицу</th>
                                                        <th>Сумма</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orderDetails.items.map((item: any, index: number) => (
                                                        <tr key={index}>
                                                            <td>{item.product_name}</td>
                                                            <td>{item.category_name}</td>
                                                            <td>{item.quantity} шт.</td>
                                                            <td>{item.unit_price} ₽</td>
                                                            <td>{(item.quantity * item.unit_price).toLocaleString()} ₽</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan={4}><strong>Итого:</strong></td>
                                                        <td><strong>{orderDetails.order?.total_amount?.toLocaleString() || selectedOrder.total_amount?.toLocaleString()} ₽</strong></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        ) : (
                                            <p>Загрузка товаров...</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="loading-details">
                                    <p>Загрузка деталей заявки...</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-selection">
                            <p>Выберите заявку для просмотра деталей</p>
                        </div>
                    )}
                </div>
            </div>

            {showCreateForm && (
                <div className="modal-overlay">
                    <div className="modal wide-modal">
                        <h2>Создание заявки на закупку</h2>
                        
                        <div className="form-group">
                            <label>Поставщик *</label>
                            <select
                                value={newOrder.supplier_id}
                                onChange={(e) => setNewOrder({...newOrder, supplier_id: e.target.value})}
                                required
                            >
                                <option value="">Выберите поставщика</option>
                                {activeSuppliers.map(supplier => (
                                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="add-item-form">
                            <h4>Добавить товары</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Товар</label>
                                    <select
                                        value={newItem.product_id}
                                        onChange={(e) => {
                                            const productId = e.target.value;
                                            const product = Array.isArray(products) 
                                                ? products.find(p => p.id === parseInt(productId))
                                                : undefined;
                                            setNewItem({
                                                ...newItem,
                                                product_id: productId,
                                                unit_price: product ? product.price : 0
                                            });
                                        }}
                                    >
                                        <option value="">Выберите товар</option>
                                        {Array.isArray(products) && products.map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.name} (остаток: {product.stock} шт.)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Количество</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Цена за единицу</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newItem.unit_price}
                                        onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <button 
                                        type="button" 
                                        onClick={handleAddItem}
                                        className="add-btn"
                                        disabled={!newItem.product_id}
                                    >
                                        Добавить
                                    </button>
                                </div>
                            </div>
                        </div>

                        {newOrder.items.length > 0 && (
                            <div className="items-list">
                                <h4>Товары в заявке ({newOrder.items.length})</h4>
                                <div className="table-responsive">
                                    <table className="items-table">
                                        <thead>
                                            <tr>
                                                <th>Товар</th>
                                                <th>Количество</th>
                                                <th>Цена за единицу</th>
                                                <th>Сумма</th>
                                                <th style={{ width: '60px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {newOrder.items.map((item, index) => {
                                                const unitPrice = typeof item.unit_price === 'number' 
                                                    ? item.unit_price 
                                                    : parseFloat(item.unit_price || 0);
                                                const itemTotal = item.quantity * unitPrice;
                                                
                                                return (
                                                    <tr key={index}>
                                                        <td>
                                                            <div style={{ fontWeight: '600' }}>{item.name}</div>
                                                            <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                                                                ID: {item.product_id}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>{item.quantity} шт.</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {unitPrice.toFixed(2)} ₽
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                                            {itemTotal.toLocaleString('ru-RU', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            })} ₽
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '8px' }}>
                                                            <button 
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="remove-icon-btn"
                                                                title="Удалить товар"
                                                                aria-label="Удалить товар"
                                                            >
                                                                <span className="remove-icon">×</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={3} style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                                    <strong>Общая сумма:</strong>
                                                </td>
                                                <td colSpan={2} style={{ textAlign: 'right' }}>
                                                    <strong style={{ fontSize: '1.2rem', color: '#27ae60' }}>
                                                        {newOrder.items
                                                            .reduce((sum, item) => {
                                                                const unitPrice = typeof item.unit_price === 'number' 
                                                                    ? item.unit_price 
                                                                    : parseFloat(item.unit_price || 0);
                                                                return sum + (item.quantity * unitPrice);
                                                            }, 0)
                                                            .toLocaleString('ru-RU', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            })} ₽
                                                    </strong>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button 
                                onClick={handleCreateOrder}
                                className="cta-button"
                                disabled={newOrder.items.length === 0 || !newOrder.supplier_id}
                            >
                                Создать заявку
                            </button>
                            <button 
                                onClick={() => {
                                    setShowCreateForm(false);
                                    setNewOrder({
                                        supplier_id: '',
                                        items: []
                                    });
                                }}
                                className="secondary-btn"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {ratingModal && (
                <div className="modal-overlay">
                    <div className="modal rating-modal">
                        <h2>⭐ Оцените поставщика</h2>
                        <p>Заявка #{ratingModal.poId} получена от {ratingModal.supplierName}</p>
                        
                        <div className="rating-container" style={{ textAlign: 'center', margin: '30px 0' }}>
                            <StarRating 
                                value={ratingModal.currentRating}
                                onChange={(rating) => setRatingModal({
                                    ...ratingModal,
                                    currentRating: rating
                                })}
                                size="large"
                            />
                        </div>
                        
                        <div className="modal-actions" style={{ justifyContent: 'center' }}>
                            <button 
                                onClick={handleRatingSubmit}
                                className="cta-button"
                                disabled={ratingModal.currentRating === 0}
                            >
                                Подтвердить оценку
                            </button>
                            <button 
                                onClick={handleSkipRating}
                                className="secondary-btn"
                            >
                                Пропустить
                            </button>
                        </div>
                        
                        <p className="rating-modal-note">
                            Оценка влияет на общий рейтинг поставщика
                        </p>
                    </div>
                </div>
            )}


        </div>
    );
};

export default OrderManagement;