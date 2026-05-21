import React, { useState, useEffect, useMemo } from 'react';
import './Merchandiser.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type {
    MerchandiserOrder,
    MerchandiserOrderDetails,
    MerchandiserOrderStatus,
} from '../../types/merchandiser';

const ORDER_NEXT_STATUSES: Record<string, string[]> = {
    'В обработке': ['Подтвержден', 'Отменен'],
    Подтвержден: ['Выдан'],
    Отменен: [],
    Выдан: []
};

function getAllowedNextStatuses(current: string): string[] {
    return ORDER_NEXT_STATUSES[current] ?? [];
}

function shortNextActionLabel(next: string): string {
    const map: Record<string, string> = {
        Подтвержден: 'Подтвердить',
        Отменен: 'В отмену',
        Выдан: 'Выдать'
    };
    return map[next] || next;
}

const OrderManagement = () => {
    const [orders, setOrders] = useState<MerchandiserOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<MerchandiserOrderDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('Все');
    const [statuses, setStatuses] = useState<MerchandiserOrderStatus[]>([]);
    const [statusesLoading, setStatusesLoading] = useState(true);
    const [archiveView, setArchiveView] = useState<'active' | 'archive'>('active');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkTargetStatus, setBulkTargetStatus] = useState('');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

    const statusOptions = ['Все', ...statuses.map(s => s.name)];

    const fetchOrderStatuses = async () => {
        try {
            const response = await fetch(API_URLS.ORDERS.STATUSES, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Ошибка загрузки статусов');

            const data = await response.json();
            setStatuses(data);
        } catch (err: any) {
            console.error('Ошибка загрузки статусов:', err);
            setStatuses([
                { id: 1, name: 'В обработке' },
                { id: 2, name: 'Подтвержден' },
                { id: 3, name: 'Отменен' },
                { id: 4, name: 'Выдан' }
            ]);
        } finally {
            setStatusesLoading(false);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(
                API_URLS.ORDERS.ALL_ORDERS({ archive: archiveView === 'archive' }),
                {
                    headers: getAuthHeaders()
                }
            );

            if (!response.ok) throw new Error('Ошибка загрузки заказов');

            const data = await response.json();
            setOrders(data);
            setSelectedIds([]);
            setBulkTargetStatus('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrderStatuses();
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [archiveView]);

    const fetchOrderDetails = async (orderId: number) => {
        try {
            const response = await fetch(API_URLS.ORDERS.ADMIN_ORDER_DETAILS(orderId), {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Ошибка загрузки деталей заказа');

            const data = await response.json();
            setSelectedOrder(data);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const updateOrderStatus = async (orderId: number, newStatus: string) => {
        try {
            const response = await fetch(API_URLS.ORDERS.UPDATE_STATUS(orderId), {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Ошибка обновления статуса');

            alert(data.message || 'Статус заказа обновлен!');
            await fetchOrders();
            if (selectedOrder?.id === orderId) {
                setSelectedOrder({
                    ...selectedOrder,
                    status: newStatus
                });
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    const bulkUpdateStatus = async () => {
        if (!bulkTargetStatus || selectedIds.length === 0) return;
        setBulkSubmitting(true);
        try {
            const response = await fetch(API_URLS.ORDERS.BATCH_UPDATE_STATUS, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ order_ids: selectedIds, status: bulkTargetStatus })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка массового обновления');
            alert(data.message || 'Готово');
            await fetchOrders();
            if (selectedOrder && selectedIds.includes(selectedOrder.id)) {
                setSelectedOrder({ ...selectedOrder, status: bulkTargetStatus });
            }
            setBulkTargetStatus('');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setBulkSubmitting(false);
        }
    };

    const callCustomer = (phone: string) => {
        window.open(`tel:${phone}`, '_blank');
    };

    const filteredOrders = useMemo(
        () =>
            statusFilter === 'Все'
                ? orders
                : orders.filter(order => order.status === statusFilter),
        [orders, statusFilter]
    );

    const bulkNextOptions = useMemo(() => {
        const selected = orders.filter(o => selectedIds.includes(o.id));
        if (selected.length === 0) return [];
        const st = selected[0].status;
        if (!selected.every(o => o.status === st)) return [];
        return getAllowedNextStatuses(st);
    }, [orders, selectedIds]);

    const selectAllFiltered = () => {
        if (selectedIds.length === filteredOrders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredOrders.map(o => o.id));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'В обработке':
                return '#f39c12';
            case 'Подтвержден':
                return '#3498db';
            case 'Отменен':
                return '#e74c3c';
            case 'Выдан':
                return '#2ecc71';
            default:
                return '#7f8c8d';
        }
    };

    if (loading || statusesLoading) return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error-message">{error}</div>;

    const listTitle =
        archiveView === 'archive'
            ? `Архив (старше 30 дней)`
            : `Активные заказы (последние 30 дней)`;

    return (
        <div className="merchandiser-page">
            <div className="page-header">
                <h1>Управление заказами</h1>
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
                    Активные
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
                В списке «Активные» отображаются заказы не старше 30 дней с даты создания. Остальные —
                во вкладке «Архив».
            </p>

            <div className="page-header orders-toolbar-row">
                <div className="filter-controls">
                    <span>Фильтр по статусу:</span>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="status-filter"
                    >
                        {statusOptions.map(option => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="orders-viewmode-toggle" role="group" aria-label="Вид списка заказов">
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

            {selectedIds.length > 0 && (
                <div className="orders-bulk-bar">
                    <span>
                        Выбрано: <strong>{selectedIds.length}</strong>
                    </span>
                    <button type="button" className="link-like-btn" onClick={selectAllFiltered}>
                        {selectedIds.length === filteredOrders.length ? 'Снять выделение' : 'Выделить все на экране'}
                    </button>
                    {bulkNextOptions.length > 0 ? (
                        <>
                            <select
                                value={bulkTargetStatus}
                                onChange={e => setBulkTargetStatus(e.target.value)}
                                className="status-filter"
                            >
                                <option value="">Массово перевести в…</option>
                                {bulkNextOptions.map(s => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="cta-button small"
                                disabled={!bulkTargetStatus || bulkSubmitting}
                                onClick={bulkUpdateStatus}
                            >
                                {bulkSubmitting ? '…' : 'Применить'}
                            </button>
                        </>
                    ) : (
                        <span className="bulk-hint-warn">
                            {(() => {
                                const sel = orders.filter(o => selectedIds.includes(o.id));
                                const mixed =
                                    sel.length > 1 &&
                                    !sel.every(o => o.status === sel[0].status);
                                if (mixed) {
                                    return 'Выберите заказы с одинаковым статусом для массовой смены.';
                                }
                                return 'Для выбранных заказов нет доступных переходов.';
                            })()}
                        </span>
                    )}
                </div>
            )}

            <div className="orders-container">
                <div
                    className={`orders-list-sidebar ${viewMode === 'table' ? 'orders-list-sidebar--table' : ''}`}
                >
                    <h3>
                        {listTitle} ({filteredOrders.length})
                    </h3>

                    {viewMode === 'cards' ? (
                        filteredOrders.map(order => (
                            <div
                                key={order.id}
                                className={`order-item ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                                onClick={() => fetchOrderDetails(order.id)}
                            >
                                <div className="order-item-header">
                                    <label
                                        className="order-checkbox-wrap"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(order.id)}
                                            onChange={() =>
                                                setSelectedIds(prev =>
                                                    prev.includes(order.id)
                                                        ? prev.filter(x => x !== order.id)
                                                        : [...prev, order.id]
                                                )
                                            }
                                        />
                                    </label>
                                    <span className="order-id">Заказ #{order.id}</span>
                                    <span
                                        className="status-badge"
                                        style={{ backgroundColor: getStatusColor(order.status) }}
                                    >
                                        {order.status}
                                    </span>
                                </div>
                                <div className="order-item-details">
                                    <p>
                                        <strong>{order.customer_name}</strong>
                                    </p>
                                    <p>{order.customer_email}</p>
                                    <p>{order.phone}</p>
                                    <p className="order-date">
                                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                                    </p>
                                    <p className="order-total">{order.total.toLocaleString()} ₽</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="orders-table-scroll">
                            <table className="orders-data-table">
                                <thead>
                                    <tr>
                                        <th className="col-check"></th>
                                        <th>№</th>
                                        <th>Дата</th>
                                        <th>Клиент</th>
                                        <th>Сумма</th>
                                        <th>Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map(order => (
                                        <tr
                                            key={order.id}
                                            className={selectedOrder?.id === order.id ? 'row-selected' : ''}
                                            onClick={() => fetchOrderDetails(order.id)}
                                        >
                                            <td
                                                className="col-check"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(order.id)}
                                                    onChange={() =>
                                                        setSelectedIds(prev =>
                                                            prev.includes(order.id)
                                                                ? prev.filter(x => x !== order.id)
                                                                : [...prev, order.id]
                                                        )
                                                    }
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className="mono">#{order.id}</td>
                                            <td className="nowrap">
                                                {new Date(order.created_at).toLocaleDateString('ru-RU')}
                                            </td>
                                            <td className="td-client">
                                                <span className="td-name">{order.customer_name}</span>
                                                <span className="td-sub">{order.phone}</span>
                                            </td>
                                            <td>{order.total.toLocaleString()} ₽</td>
                                            <td>
                                                <span
                                                    className="status-badge table-badge"
                                                    style={{
                                                        backgroundColor: getStatusColor(order.status)
                                                    }}
                                                >
                                                    {order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {filteredOrders.length === 0 && (
                        <div className="empty-state">
                            <p>Заказы не найдены</p>
                        </div>
                    )}
                </div>

                <div className="order-details-panel">
                    {selectedOrder ? (
                        <>
                            <div className="order-details-header">
                                <div>
                                    <h2>Заказ #{selectedOrder.id}</h2>
                                    <p className="customer-info">
                                        {selectedOrder.customer_name} • {selectedOrder.phone}
                                    </p>
                                    <p className="status-now-line">
                                        Текущий статус:{' '}
                                        <strong style={{ color: getStatusColor(selectedOrder.status) }}>
                                            {selectedOrder.status}
                                        </strong>
                                    </p>
                                </div>

                                <div className="order-actions">
                                    <button
                                        type="button"
                                        onClick={() => callCustomer(selectedOrder.phone)}
                                        className="call-btn"
                                    >
                                        📞 Позвонить
                                    </button>

                                    <div className="single-status-change">
                                        <span className="single-status-label">Статус заказа:</span>
                                        {getAllowedNextStatuses(selectedOrder.status).length > 0 ? (
                                            <>
                                                <div className="status-quick-buttons">
                                                    {getAllowedNextStatuses(selectedOrder.status).map(
                                                        name => (
                                                            <button
                                                                key={name}
                                                                type="button"
                                                                className="status-quick-btn"
                                                                style={{
                                                                    borderColor: getStatusColor(name)
                                                                }}
                                                                onClick={() =>
                                                                    updateOrderStatus(selectedOrder.id, name)
                                                                }
                                                            >
                                                                → {shortNextActionLabel(name)}
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="no-transitions-msg">
                                                Финальный статус — изменить нельзя
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="order-info-grid">
                                <div className="info-card">
                                    <h4>Клиент</h4>
                                    <p>
                                        <strong>ФИО:</strong> {selectedOrder.customer_name}
                                    </p>
                                    <p>
                                        <strong>Email:</strong> {selectedOrder.customer_email}
                                    </p>
                                    <p>
                                        <strong>Телефон:</strong> {selectedOrder.phone}
                                    </p>
                                </div>

                                <div className="info-card">
                                    <h4>Заказ</h4>
                                    <p>
                                        <strong>ID заказа:</strong> #{selectedOrder.id}
                                    </p>
                                    <p>
                                        <strong>Дата создания:</strong>{' '}
                                        {new Date(selectedOrder.created_at).toLocaleString('ru-RU')}
                                    </p>
                                    <p>
                                        <strong>Обновлён:</strong>{' '}
                                        {new Date(selectedOrder.updated_at).toLocaleString('ru-RU')}
                                    </p>
                                    <p>
                                        <strong>Позиций:</strong> {selectedOrder.items?.length || 0}
                                    </p>
                                </div>
                            </div>

                            <div className="info-card order-items-card">
                                <h4>Товары в заказе</h4>

                                <table className="order-items-table">
                                    <thead>
                                        <tr>
                                            <th>Товар</th>
                                            <th>Кол-во</th>
                                            <th>Цена</th>
                                            <th>Сумма</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.items?.map(item => (
                                            <tr key={item.id}>
                                                <td>{item.name}</td>
                                                <td>{item.quantity} шт.</td>
                                                <td>{item.price.toLocaleString()} ₽</td>
                                                <td>{item.total.toLocaleString()} ₽</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={3} className="text-right">
                                                <strong>Итого:</strong>
                                            </td>
                                            <td>
                                                <strong>{selectedOrder.total.toLocaleString()} ₽</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="no-selection">
                            <p>Выберите заказ для просмотра деталей</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderManagement;
