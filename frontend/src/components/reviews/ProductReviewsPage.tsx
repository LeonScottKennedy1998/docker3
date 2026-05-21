import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StarRating from '../reviews/StarRating';
import { API_URLS, getAuthHeaders } from '../../config/api';
import './ProductReviewsPage.css';

const ProductReviewsPage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const [product, setProduct] = useState<any>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchProduct();
        fetchReviews();
    }, [productId]);
    
    const fetchProduct = async () => {
        try {
            const response = await fetch(API_URLS.PRODUCTS.BY_ID(productId!), {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                setProduct(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки товара:', error);
        }
    };
    
    const fetchReviews = async () => {
        setLoading(true);
        try {
            const response = await fetch(API_URLS.REVIEWS.PRODUCT_REVIEWS(productId!));
            const data = await response.json();
            setReviews(data.reviews || []);
            setAvgRating(data.avg_rating || 0);
            setTotalReviews(data.total_reviews || 0);
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
        } finally {
            setLoading(false);
        }
    };
    
    if (loading) return <div className="loading">Загрузка...</div>;
    
    return (
        <div className="product-reviews-page">
            <div className="page-header">
                <button className="back-btn" onClick={() => navigate(-1)}>← Назад</button>
                <h1>Отзывы о товаре</h1>
            </div>
            
            {product && (
                <div className="product-info-card">
                    <div className="product-info-image">
                        {product.images?.[0] || product.image_url ? (
                            <img
                                src={product.images?.[0] || product.image_url}
                                alt={product.name}
                            />
                        ) : (
                            <div className="info-placeholder">{product.name.charAt(0)}</div>
                        )}
                    </div>
                    <div className="product-info-content">
                        <h2>{product.name}</h2>
                        <p className="product-price">{product.price.toLocaleString()} ₽</p>
                        <div className="product-rating">
                            <StarRating rating={avgRating} readonly={true} size="medium" />
                            <span className="total-reviews">• {totalReviews} отзывов</span>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="reviews-section">
                <h3>Отзывы покупателей</h3>
                
                <div className="reviews-list">
                    {reviews.length === 0 ? (
                        <div className="no-reviews">
                            <p>Пока нет отзывов. Будьте первым!</p>
                        </div>
                    ) : (
                        reviews.map((review: any) => (
                            <div key={review.review_id} className="review-card">
                                <div className="review-header">
                                    <div className="review-user">
                                        <strong>{review.first_name} {review.last_name}</strong>
                                    </div>
                                    <div className="review-date">
                                        {new Date(review.created_at).toLocaleDateString('ru-RU', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </div>
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

export default ProductReviewsPage;