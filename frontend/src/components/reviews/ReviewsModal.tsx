import React, { useState, useEffect } from 'react';
import StarRating from './StarRating';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { ReviewsModalProps } from '../../types/props';

const ReviewsModal: React.FC<ReviewsModalProps> = ({ productId, productName, onClose }) => {
    const [reviews, setReviews] = useState<any[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    useEffect(() => {
        fetchReviews();
    }, [productId]);
    
    const fetchReviews = async () => {
        setLoading(true);
        setError('');
        
        try {
            const response = await fetch(API_URLS.REVIEWS.PRODUCT_REVIEWS(productId));
            
            if (!response.ok) {
                throw new Error('Ошибка загрузки отзывов');
            }
            
            const data = await response.json();
            setReviews(data.reviews || []);
            setAvgRating(data.avg_rating || 0);
            setTotalReviews(data.total_reviews || 0);
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
            setError('Не удалось загрузить отзывы');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content reviews-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>✕</button>
                
                <div className="reviews-header">
                    <h2>Отзывы о товаре «{productName}»</h2>
                    {!loading && totalReviews > 0 && (
                        <div className="reviews-summary">
                            <StarRating rating={avgRating} readonly={true} size="large" />
                            <span className="avg-rating">{avgRating.toFixed(1)}</span>
                            <span className="total-reviews">({totalReviews} отзывов)</span>
                        </div>
                    )}
                </div>
                
                <div className="reviews-list">
                    {loading ? (
                        <div className="loading">Загрузка отзывов...</div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : reviews.length === 0 ? (
                        <div className="no-reviews">
                            <p>Пока нет отзывов. Будьте первым!</p>
                        </div>
                    ) : (
                        reviews.map((review: any) => (
                            <div key={review.review_id} className="review-item">
                                <div className="review-header">
                                    <span className="review-user">{review.first_name} {review.last_name}</span>
                                    <span className="review-date">
                                        {new Date(review.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                                <StarRating rating={review.rating} readonly={true} size="small" />
                                <p className="review-comment">{review.comment}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewsModal;