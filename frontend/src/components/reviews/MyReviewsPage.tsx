import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { API_URLS, getAuthHeaders } from '../../config/api';
import './MyReviewsPage.css';
import type {
    MyReviewsFilterState,
    MyReviewsSortOrder,
    MyReviewsTabId,
    ReviewableProduct,
} from '../../types/reviews';

const DEFAULT_FILTER: MyReviewsFilterState = { sort: 'desc', dateFrom: '', dateTo: '' };

const MyReviewsPage: React.FC = () => {
    const [reviewableProducts, setReviewableProducts] = useState<ReviewableProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<number | null>(null);
    const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<MyReviewsTabId>('pending');

    const [pendingFilter, setPendingFilter] = useState<MyReviewsFilterState>(DEFAULT_FILTER);
    const [reviewedFilter, setReviewedFilter] = useState<MyReviewsFilterState>(DEFAULT_FILTER);

    useEffect(() => {
        fetchReviewableProducts();
    }, []);

    const fetchReviewableProducts = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setLoading(true);
        try {
            const response = await fetch(API_URLS.REVIEWS.REVIEWABLE_PRODUCTS, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Ошибка загрузки');

            const data = await response.json();
            setReviewableProducts(data);
        } catch (error) {
            console.error('Ошибка:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateReview = async (
        productId: number,
        orderId: number,
        rating: number,
        comment: string
    ) => {
        setSubmitting(productId);
        try {
            const response = await fetch(API_URLS.REVIEWS.CREATE(productId), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ rating, comment, preorder_id: orderId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка отправки отзыва');
            }

            alert('Спасибо за отзыв!');
            await fetchReviewableProducts();
            setActiveTab('reviewed');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSubmitting(null);
        }
    };

    const handleUpdateReview = async (reviewId: number, rating: number, comment: string) => {
        setSubmitting(reviewId);
        try {
            const response = await fetch(API_URLS.REVIEWS.UPDATE(reviewId), {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ rating, comment })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка обновления');
            }

            alert('Отзыв обновлён');
            setEditingReviewId(null);
            await fetchReviewableProducts();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSubmitting(null);
        }
    };

    const handleDeleteReview = async (reviewId: number) => {
        if (!window.confirm('Удалить отзыв?')) return;
        try {
            const response = await fetch(API_URLS.REVIEWS.DELETE(reviewId), {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Ошибка удаления');

            alert('Отзыв удалён');
            await fetchReviewableProducts();
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Не удалось удалить отзыв');
        }
    };

    const allPending = useMemo(
        () => reviewableProducts.filter(p => !p.has_reviewed),
        [reviewableProducts]
    );
    const allReviewed = useMemo(
        () => reviewableProducts.filter(p => p.has_reviewed),
        [reviewableProducts]
    );

    // Применение фильтра: сортировка + диапазон дат.
    // Для "pending" фильтр работает по дате получения заказа, для "reviewed" — по дате отзыва.
    const applyFilter = (
        list: ReviewableProduct[],
        filter: MyReviewsFilterState,
        dateField: 'order_date' | 'review_created_at'
    ): ReviewableProduct[] => {
        const fromTs = filter.dateFrom ? new Date(filter.dateFrom).getTime() : null;
        const toTs = filter.dateTo ? new Date(filter.dateTo + 'T23:59:59').getTime() : null;

        const filtered = list.filter(p => {
            const raw = p[dateField] || p.order_date;
            if (!raw) return true;
            const ts = new Date(raw).getTime();
            if (fromTs !== null && ts < fromTs) return false;
            if (toTs !== null && ts > toTs) return false;
            return true;
        });

        return filtered.sort((a, b) => {
            const aTs = new Date(a[dateField] || a.order_date).getTime();
            const bTs = new Date(b[dateField] || b.order_date).getTime();
            return filter.sort === 'desc' ? bTs - aTs : aTs - bTs;
        });
    };

    const pendingProducts = useMemo(
        () => applyFilter(allPending, pendingFilter, 'order_date'),
        [allPending, pendingFilter]
    );
    const reviewedProducts = useMemo(
        () => applyFilter(allReviewed, reviewedFilter, 'review_created_at'),
        [allReviewed, reviewedFilter]
    );

    const ProductImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
        if (!src) {
            return <div className="review-card-img placeholder">📦</div>;
        }
        return (
            <div className="review-card-img">
                <img
                    src={src}
                    alt={alt}
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                />
            </div>
        );
    };

    // Карточка для товара, ожидающего отзыва (стиль Озона)
    const PendingCard: React.FC<{ product: ReviewableProduct }> = ({ product }) => {
        const [isFormOpen, setIsFormOpen] = useState(false);
        const [rating, setRating] = useState(5);
        const [comment, setComment] = useState('');
        const isSubmitting = submitting === product.id;

        return (
            <div className="review-card pending-card">
                <ProductImage src={product.image_url} alt={product.name} />
                <div className="review-card-info">
                    <div className="pending-badge">Товар ждёт отзыва</div>
                    <h3>
                        <Link to={`/product-reviews/${product.id}`} className="product-name-link">
                            {product.name}
                        </Link>
                    </h3>
                    <p className="product-category">{product.category}</p>
                    <p className="product-price">{product.price.toLocaleString()} ₽</p>
                    <p className="order-date">
                        Заказ №{product.order_id} · получен{' '}
                        {new Date(product.order_date).toLocaleDateString('ru-RU')}
                    </p>

                    {!isFormOpen ? (
                        <button onClick={() => setIsFormOpen(true)} className="write-review-btn">
                            ✍️ Оценить товар
                        </button>
                    ) : (
                        <div className="review-form">
                            <div className="rating-section">
                                <label>Ваша оценка:</label>
                                <StarRating rating={rating} onRatingChange={setRating} size="large" />
                            </div>
                            <div className="comment-section">
                                <label>Комментарий:</label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                    placeholder="Расскажите о товаре..."
                                />
                            </div>
                            <div className="form-actions">
                                <button
                                    onClick={() => handleCreateReview(product.id, product.order_id, rating, comment)}
                                    disabled={isSubmitting}
                                    className="submit-btn"
                                >
                                    {isSubmitting ? 'Отправка...' : 'Отправить'}
                                </button>
                                <button
                                    onClick={() => setIsFormOpen(false)}
                                    className="cancel-btn"
                                    disabled={isSubmitting}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Карточка для уже оцененного товара
    const ReviewedCard: React.FC<{ product: ReviewableProduct }> = ({ product }) => {
        const isEditing = editingReviewId === product.review_id;
        const [rating, setRating] = useState(product.rating || 5);
        const [comment, setComment] = useState(product.comment || '');
        const isSubmitting = submitting === product.review_id;

        useEffect(() => {
            if (isEditing) {
                setRating(product.rating || 5);
                setComment(product.comment || '');
            }
        }, [isEditing, product.rating, product.comment]);

        return (
            <div className={`review-card reviewed-card ${isEditing ? 'edit-mode' : ''}`}>
                <ProductImage src={product.image_url} alt={product.name} />
                <div className="review-card-info">
                    <h3>
                        <Link to={`/product-reviews/${product.id}`} className="product-name-link">
                            {product.name}
                        </Link>
                    </h3>
                    <p className="product-category">{product.category}</p>
                    <p className="product-price">{product.price.toLocaleString()} ₽</p>
                    <p className="order-date">Заказ №{product.order_id}</p>

                    {isEditing ? (
                        <div className="review-form">
                            <div className="rating-section">
                                <label>Оценка:</label>
                                <StarRating rating={rating} onRatingChange={setRating} size="large" />
                            </div>
                            <div className="comment-section">
                                <label>Комментарий:</label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="form-actions">
                                <button
                                    onClick={() => handleUpdateReview(product.review_id!, rating, comment)}
                                    disabled={isSubmitting}
                                    className="submit-btn"
                                >
                                    {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                                </button>
                                <button
                                    onClick={() => setEditingReviewId(null)}
                                    className="cancel-btn"
                                    disabled={isSubmitting}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="my-rating">
                                <StarRating rating={product.rating || 0} readonly={true} size="small" />
                                <span className="rating-value">{product.rating}/5</span>
                            </div>
                            {product.comment && (
                                <p className="review-comment-preview">{product.comment}</p>
                            )}
                            {product.review_created_at && (
                                <p className="order-date">
                                    Отзыв оставлен: {new Date(product.review_created_at).toLocaleDateString('ru-RU')}
                                </p>
                            )}
                            <div className="review-actions">
                                <button
                                    onClick={() => setEditingReviewId(product.review_id!)}
                                    className="edit-btn"
                                >
                                    ✏️ Редактировать
                                </button>
                                <button
                                    onClick={() => handleDeleteReview(product.review_id!)}
                                    className="delete-btn"
                                >
                                    🗑️ Удалить
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const FilterBar: React.FC<{
        filter: MyReviewsFilterState;
        onChange: (next: MyReviewsFilterState) => void;
    }> = ({ filter, onChange }) => {
        const reset = () => onChange(DEFAULT_FILTER);
        const hasFilter = filter.dateFrom || filter.dateTo || filter.sort !== 'desc';

        return (
            <div className="reviews-filter">
                <div className="filter-field">
                    <label>Сортировка:</label>
                    <select
                        value={filter.sort}
                        onChange={(e) => onChange({ ...filter, sort: e.target.value as MyReviewsSortOrder })}
                    >
                        <option value="desc">Сначала новые</option>
                        <option value="asc">Сначала старые</option>
                    </select>
                </div>
                <div className="filter-field">
                    <label>С:</label>
                    <input
                        type="date"
                        value={filter.dateFrom}
                        onChange={(e) => onChange({ ...filter, dateFrom: e.target.value })}
                    />
                </div>
                <div className="filter-field">
                    <label>По:</label>
                    <input
                        type="date"
                        value={filter.dateTo}
                        onChange={(e) => onChange({ ...filter, dateTo: e.target.value })}
                    />
                </div>
                {hasFilter && (
                    <button onClick={reset} className="filter-reset-btn" type="button">
                        Сбросить
                    </button>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="my-reviews-page">
                <div className="loading">Загрузка...</div>
            </div>
        );
    }

    const currentFilter = activeTab === 'pending' ? pendingFilter : reviewedFilter;
    const setCurrentFilter = activeTab === 'pending' ? setPendingFilter : setReviewedFilter;
    const currentList = activeTab === 'pending' ? pendingProducts : reviewedProducts;
    const totalForTab = activeTab === 'pending' ? allPending.length : allReviewed.length;

    return (
        <div className="my-reviews-page">
            <div className="page-header">
                <h1>Мои отзывы</h1>
                <Link to="/catalog" className="back-to-catalog">
                    ← Вернуться в каталог
                </Link>
            </div>

            <div className="reviews-tabs">
                <button
                    className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                    type="button"
                >
                    📝 Ожидают отзыва
                    <span className="tab-count">{allPending.length}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'reviewed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reviewed')}
                    type="button"
                >
                    ⭐ Мои отзывы
                    <span className="tab-count">{allReviewed.length}</span>
                </button>
            </div>

            {totalForTab > 0 && (
                <FilterBar filter={currentFilter} onChange={setCurrentFilter} />
            )}

            {totalForTab === 0 ? (
                <div className="empty-state">
                    {activeTab === 'pending' ? (
                        <>
                            <p>🎉 Все ваши товары уже оценены</p>
                            <p className="small-note">
                                Новые товары для отзыва появятся здесь после получения заказа
                            </p>
                        </>
                    ) : (
                        <>
                            <p>Вы пока не оставили ни одного отзыва</p>
                            <p className="small-note">
                                Перейдите на вкладку «Ожидают отзыва» и оцените товары
                            </p>
                        </>
                    )}
                    <Link to="/catalog">
                        <button className="cta-button">Перейти в каталог</button>
                    </Link>
                </div>
            ) : currentList.length === 0 ? (
                <div className="empty-state">
                    <p>По выбранным фильтрам ничего не найдено</p>
                    <button
                        className="cta-button"
                        onClick={() => setCurrentFilter(DEFAULT_FILTER)}
                    >
                        Сбросить фильтры
                    </button>
                </div>
            ) : (
                <div className="reviews-grid">
                    {activeTab === 'pending'
                        ? currentList.map(product => (
                              <PendingCard
                                  key={`${product.order_id}-${product.id}`}
                                  product={product}
                              />
                          ))
                        : currentList.map(product => (
                              <ReviewedCard
                                  key={`${product.order_id}-${product.id}`}
                                  product={product}
                              />
                          ))}
                </div>
            )}
        </div>
    );
};

export default MyReviewsPage;
