import React, { useState, useEffect } from 'react';
import './ProcurementDashboard.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { StockAnalysisProduct, StockRecommendation } from '../../types/procurement';

function stockLevelToUrgency(level: string): StockRecommendation['urgency_level'] {
    switch (level) {
        case 'КРИТИЧЕСКИЙ':
            return 'critical';
        case 'НИЗКИЙ':
            return 'high';
        case 'НОРМАЛЬНЫЙ':
            return 'medium';
        case 'ВЫСОКИЙ':
            return 'low';
        default:
            return 'medium';
    }
}

function mapApiRecommendation(r: Record<string, unknown>): StockRecommendation {
    const stockLevel = String(r.stock_level || '');
    return {
        id: Number(r.product_id),
        name: String(r.product_name),
        stock: Number(r.stock) || 0,
        price: Number(r.price) || 0,
        category: String(r.category_name || ''),
        recommended_qty: Number(r.recommended_qty) || 0,
        urgency_level: stockLevelToUrgency(stockLevel),
        estimated_usage_days: Number(r.estimated_usage_days) || 0,
        avg_monthly_sales: Number(r.monthly_velocity) || 0,
        sold_90_days: Number(r.sold_90_days) || 0,
        sold_365_days: Number(r.sold_365_days) || 0,
        orders_365_days: Number(r.orders_365_days) || 0,
        last_sale_at: r.last_sale_at ? String(r.last_sale_at) : null,
        stock_level: stockLevel,
        monthly_velocity: Number(r.monthly_velocity) || 0,
        sales_pace: String(r.sales_pace || ''),
        sales_pace_label: String(r.sales_pace_label || ''),
        months_of_cover: r.months_of_cover != null ? Number(r.months_of_cover) : null,
        recommendation: String(r.recommendation || ''),
        procurement_hint: String(r.procurement_hint || ''),
    };
}

function formatLastSale(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU');
}

const StockAnalysis = () => {
    const [stockItems, setStockItems] = useState<StockAnalysisProduct[]>([]);
    const [recommendations, setRecommendations] = useState<StockRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
    const [sortBy, setSortBy] = useState<'stock' | 'urgency' | 'sales'>('urgency');

    const parseProductsPayload = (productsData: unknown): StockAnalysisProduct[] => {
        if (Array.isArray(productsData)) {
            return productsData.map((p: any) => ({
                id: p.id || p.product_id,
                name: p.name || p.product_name || 'Без названия',
                stock: p.stock || 0,
                price: p.price || 0,
                category: p.category || p.category_name || 'Без категории',
            }));
        }
        const data = productsData as any;
        if (data && Array.isArray(data.products)) {
            return data.products.map((p: any) => ({
                id: p.id || p.product_id,
                name: p.name || p.product_name || 'Без названия',
                stock: p.stock || 0,
                price: p.price || 0,
                category: p.category || p.category_name || 'Без категории',
            }));
        }
        if (data && data.data && Array.isArray(data.data)) {
            return data.data.map((p: any) => ({
                id: p.id || p.product_id,
                name: p.name || p.product_name || 'Без названия',
                stock: p.stock || 0,
                price: p.price || 0,
                category: p.category || p.category_name || 'Без категории',
            }));
        }
        console.warn('Неожиданный формат данных товаров:', productsData);
        return [];
    };

    const fetchStockAnalysis = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Токен не найден');
            setLoading(false);
            return;
        }

        try {
            const [productsRes, recRes] = await Promise.all([
                fetch(API_URLS.PRODUCTS.BASE, { headers: getAuthHeaders() }),
                fetch(API_URLS.PROCUREMENT.RECOMMENDATIONS, { headers: getAuthHeaders() }),
            ]);

            if (!productsRes.ok) {
                throw new Error('Ошибка загрузки товаров');
            }

            const productsData = await productsRes.json();
            const products = parseProductsPayload(productsData);
            setStockItems(products);

            if (!recRes.ok) {
                const errText = await recRes.text();
                console.error('Ошибка рекомендаций закупок:', recRes.status, errText);
                setRecommendations([]);
            } else {
                const recJson = await recRes.json();
                const list = (Array.isArray(recJson) ? recJson : []).map((row) =>
                    mapApiRecommendation(row as Record<string, unknown>)
                );
                setRecommendations(list);
            }
        } catch (error) {
            console.error('❌ Ошибка анализа склада:', error);
            setStockItems([]);
            setRecommendations([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStockAnalysis();
    }, []);

    const getUrgencyLabel = (level: string) => {
        switch (level) {
            case 'critical':
                return 'КРИТИЧЕСКИЙ';
            case 'high':
                return 'ВЫСОКИЙ';
            case 'medium':
                return 'СРЕДНИЙ';
            case 'low':
                return 'НИЗКИЙ';
            default:
                return level.toUpperCase();
        }
    };

    const getUrgencyDescription = (level: string, days: number) => {
        switch (level) {
            case 'critical':
                return days === 0 ? 'Нет в наличии' : `Оценка запаса ~${days} дн. (по продажам)`;
            case 'high':
                return `Оценка ~${days} дн.`;
            case 'medium':
                return `Оценка ~${days} дн.`;
            case 'low':
                return `Оценка ~${days} дн.`;
            default:
                return '';
        }
    };

    const paceModifier = (pace: string | undefined) => {
        const p = (pace || 'moderate').replace(/[^a-z_]/gi, '');
        return p || 'moderate';
    };

    const handleQuickOrder = (product: StockRecommendation) => {
        if (!product.recommended_qty || product.recommended_qty < 1) {
            alert('Для этого товара не рассчитан объём быстрой закупки (остаток может быть достаточным).');
            return;
        }
        console.log('🚚 Быстрый заказ для:', product);

        localStorage.setItem(
            'quickOrderData',
            JSON.stringify({
                product_id: product.id,
                product_name: product.name,
                recommended_qty: product.recommended_qty,
                price: product.price,
                category: product.category,
            })
        );

        alert(
            `Товар "${product.name}" подготовлен для заказа. Перейдите на вкладку "Управление заявками" для завершения.`
        );
    };

    const filteredStockRecommendations = recommendations
        .filter((rec) => filter === 'all' || rec.urgency_level === filter)
        .sort((a, b) => {
            switch (sortBy) {
                case 'stock':
                    return a.stock - b.stock;
                case 'sales':
                    return (b.monthly_velocity || 0) - (a.monthly_velocity || 0);
                case 'urgency':
                default: {
                    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                    return urgencyOrder[a.urgency_level] - urgencyOrder[b.urgency_level];
                }
            }
        });

    const summary = {
        critical: recommendations.filter((r) => r.urgency_level === 'critical').length,
        high: recommendations.filter((r) => r.urgency_level === 'high').length,
        medium: recommendations.filter((r) => r.urgency_level === 'medium').length,
        low: recommendations.filter((r) => r.urgency_level === 'low').length,
        total: recommendations.length,
    };

    if (loading) return <div className="loading">Анализ склада...</div>;

    return (
        <div className="stock-analysis">
            <div className="section-header">
                <h2>📊 Анализ остатков на складе</h2>
                <p>
                    Рекомендации с учётом <strong>фактических продаж</strong> (предзаказы за 90 и 365 дней) и остатка.
                    Низкий склад у «медленного» товара не всегда повод заказывать много — читайте короткую подсказку в карточке.
                </p>
            </div>

            <div className="analytics-summary">
                <div className="summary-cards">
                    <div className="summary-card critical" onClick={() => setFilter('critical')}>
                        <div className="summary-icon">🔥</div>
                        <div className="summary-content">
                            <h3>{summary.critical}</h3>
                            <p>Критических</p>
                            <small>Мало на складе</small>
                        </div>
                    </div>

                    <div className="summary-card high" onClick={() => setFilter('high')}>
                        <div className="summary-icon">⚠️</div>
                        <div className="summary-content">
                            <h3>{summary.high}</h3>
                            <p>Высокий приоритет</p>
                            <small>Остаток 6–10</small>
                        </div>
                    </div>

                    <div className="summary-card medium" onClick={() => setFilter('medium')}>
                        <div className="summary-icon">📦</div>
                        <div className="summary-content">
                            <h3>{summary.medium}</h3>
                            <p>Средний приоритет</p>
                            <small>Остаток 11–20</small>
                        </div>
                    </div>

                    <div className="summary-card total" onClick={() => setFilter('all')}>
                        <div className="summary-icon">📋</div>
                        <div className="summary-content">
                            <h3>{summary.total}</h3>
                            <p>В списке</p>
                            <small>Нужен контроль остатков</small>
                        </div>
                    </div>
                </div>
            </div>

            <div className="controls-row">
                <div className="filter-controls">
                    <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                        Все ({summary.total})
                    </button>
                    <button
                        className={`filter-btn critical ${filter === 'critical' ? 'active' : ''}`}
                        onClick={() => setFilter('critical')}
                    >
                        Критические ({summary.critical})
                    </button>
                    <button
                        className={`filter-btn high ${filter === 'high' ? 'active' : ''}`}
                        onClick={() => setFilter('high')}
                    >
                        Высокие ({summary.high})
                    </button>
                    <button
                        className={`filter-btn medium ${filter === 'medium' ? 'active' : ''}`}
                        onClick={() => setFilter('medium')}
                    >
                        Средние ({summary.medium})
                    </button>
                </div>

                <div className="sort-controls">
                    <span>Сортировка:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'stock' | 'urgency' | 'sales')}
                        className="sort-select"
                    >
                        <option value="urgency">По приоритету остатка</option>
                        <option value="stock">По остатку</option>
                        <option value="sales">По темпу продаж</option>
                    </select>
                </div>
            </div>

            <div className="recommendations-list stock-rec-list-wrap">
                {filteredStockRecommendations.length > 0 ? (
                    <div className="stock-rec-cards">
                        {filteredStockRecommendations.map((rec, index) => (
                            <article
                                key={`${rec.id}-${index}`}
                                className={`stock-rec-card stock-rec-card--${rec.urgency_level}`}
                            >
                                <div className="stock-rec-card__head">
                                    <div className="stock-rec-card__titles">
                                        <h3 className="stock-rec-card__name">{rec.name}</h3>
                                        <p className="stock-rec-card__line2">
                                            {rec.category}
                                            <span className="stock-rec-card__dot">·</span>
                                            {rec.price.toLocaleString()} ₽
                                        </p>
                                        <p className="stock-rec-card__note">{getUrgencyDescription(rec.urgency_level, rec.estimated_usage_days)}</p>
                                    </div>
                                    <span className={`stock-rec-pill stock-rec-pill--${rec.urgency_level}`}>
                                        {getUrgencyLabel(rec.urgency_level)}
                                    </span>
                                </div>

                                <div className="stock-rec-metrics">
                                    <div className="stock-rec-metric">
                                        <span className="stock-rec-metric__label">Склад</span>
                                        <span className="stock-rec-metric__val">{rec.stock} шт.</span>
                                    </div>
                                    <div className="stock-rec-metric">
                                        <span className="stock-rec-metric__label">Продажи</span>
                                        <span className="stock-rec-metric__val">
                                            {rec.sold_90_days} / {rec.sold_365_days}
                                        </span>
                                        <span className="stock-rec-metric__sub">90 дн. · год</span>
                                    </div>
                                    <div className="stock-rec-metric">
                                        <span className="stock-rec-metric__label">Посл. продажа</span>
                                        <span className="stock-rec-metric__val">{formatLastSale(rec.last_sale_at)}</span>
                                    </div>
                                    <div className="stock-rec-metric">
                                        <span className="stock-rec-metric__label">Темп</span>
                                        <span className={`stock-rec-pace stock-rec-pace--${paceModifier(rec.sales_pace)}`}>
                                            {rec.sales_pace_label || '—'}
                                        </span>
                                        <span className="stock-rec-metric__sub">~{rec.monthly_velocity ?? 0} шт./мес.</span>
                                    </div>
                                    <div className="stock-rec-metric">
                                        <span className="stock-rec-metric__label">Запас</span>
                                        <span className="stock-rec-metric__val">{rec.estimated_usage_days} дн.</span>
                                        {rec.months_of_cover != null && rec.months_of_cover > 0 ? (
                                            <span className="stock-rec-metric__sub">~{rec.months_of_cover} мес.</span>
                                        ) : null}
                                    </div>
                                </div>

                                {rec.recommendation ? (
                                    <p className="stock-rec-card__verdict">{rec.recommendation}</p>
                                ) : null}

                                <p className="stock-rec-card__hint">{rec.procurement_hint}</p>

                                <div className="stock-rec-card__foot">
                                    <button
                                        type="button"
                                        className="stock-rec-cta"
                                        disabled={!rec.recommended_qty}
                                        onClick={() => handleQuickOrder(rec)}
                                        title={
                                            rec.recommended_qty
                                                ? 'Перейдите во вкладку заявок и завершите черновик'
                                                : 'Система не предлагает партию — остаток может быть достаточным'
                                        }
                                    >
                                        {rec.recommended_qty ? (
                                            <>
                                                <span className="stock-rec-cta__main">Добавить в заявку</span>
                                                <span className="stock-rec-cta__sub">
                                                    {rec.recommended_qty} шт. · ~
                                                    {(rec.recommended_qty * rec.price).toLocaleString()} ₽
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="stock-rec-cta__main">Партия не подобрана</span>
                                                <span className="stock-rec-cta__sub">Оформление недоступно</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        {recommendations.length === 0 ? (
                            <>
                                <p>🎉 Все активные товары с остатком выше 20 шт. — отдельный список закупок пуст.</p>
                                <p>
                                    <small>
                                        Как только остатки опустятся, здесь появятся строки с продажами и подсказками.
                                    </small>
                                </p>
                            </>
                        ) : (
                            <>
                                <p>Нет рекомендаций для выбранного фильтра</p>
                                <button onClick={() => setFilter('all')} className="secondary-btn">
                                    Показать все ({recommendations.length})
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="summary-section">
                <h3>📈 Статистика по складу</h3>
                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-value">{stockItems.length}</div>
                        <div className="stat-label">Всего товаров</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">{stockItems.filter((p) => p.stock < 10).length}</div>
                        <div className="stat-label">Товаров меньше 10 шт.</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">{stockItems.filter((p) => p.stock === 0).length}</div>
                        <div className="stat-label">Товаров нет в наличии</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value">
                            {stockItems.length > 0
                                ? Math.round(
                                      stockItems.reduce((sum, p) => sum + (p.stock || 0), 0) / stockItems.length
                                  )
                                : 0}
                        </div>
                        <div className="stat-label">Средний остаток</div>
                    </div>
                </div>
            </div>

            <div className="tips-section">
                <h3>💡 Советы по закупкам</h3>
                <div className="tips-list">
                    <div className="tip-item">
                        <span className="tip-icon">📉</span>
                        <div className="tip-content">
                            <strong>Остаток и продажи</strong>
                            <p>
                                Один значок на складе не всегда повод заказать сотню штук: смотрите продажи за квартал и
                                год и дату последней продажи. Помощник в таблице формируется простыми правилами по темпу,
                                без нейросети.
                            </p>
                        </div>
                    </div>
                    <div className="tip-item">
                        <span className="tip-icon">🔥</span>
                        <div className="tip-content">
                            <strong>Критические товары</strong>
                            <p>Мало единиц на складе — проверьте темп: при высокой оборачиваемости лучше не откладывать.</p>
                        </div>
                    </div>
                    <div className="tip-item">
                        <span className="tip-icon">⚠️</span>
                        <div className="tip-content">
                            <strong>Высокий приоритет</strong>
                            <p>Запланируйте закупку; объём «К закупке» уже учитывает скорость продаж.</p>
                        </div>
                    </div>
                    <div className="tip-item">
                        <span className="tip-icon">📦</span>
                        <div className="tip-content">
                            <strong>Средний приоритет</strong>
                            <p>Добавьте в плановую закупку, ориентируясь на сезон и поставщика.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockAnalysis;
