import React, { useState, useEffect } from 'react';
import { Product } from '../../types/product';
import './ProductCard.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import StarRating from '../reviews/StarRating';
import { useNavigate } from 'react-router-dom';
import type { ProductCardProps } from '../../types/props';

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    showWishlistButton = true,
    showAddToCartButton = true,
    showCategory = true,
    showDescription = true,
    onAddToCart,
    onViewDetails,
    onToggleWishlist,
    isInWishlist: externalIsInWishlist,
    className = '',
    layout = 'grid',
    showAlert = true
}) => {
    const navigate = useNavigate();
    const [internalIsInWishlist, setInternalIsInWishlist] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const isInWishlist = externalIsInWishlist !== undefined 
        ? externalIsInWishlist 
        : internalIsInWishlist;

    useEffect(() => {
        if (showWishlistButton && !externalIsInWishlist) {
            checkWishlistStatus();
        }
    }, [product.id]);

    const checkWishlistStatus = async () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token || user.role !== 'Клиент') return;

        try {
            const response = await fetch(API_URLS.WISHLIST.CHECK_PRODUCT(product.id), {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                setInternalIsInWishlist(data.isInWishlist);
            }
        } catch (error) {
            console.error('Ошибка проверки избранного:', error);
        }
    };

    const handleWishlistToggle = async () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token) {
            alert('Для добавления в избранное необходимо войти в систему');
            return;
        }

        if (user.role !== 'Клиент') {
            alert('Только клиенты могут добавлять товары в избранное');
            return;
        }

        setIsLoading(true);

        try {
            if (onToggleWishlist) {
                await onToggleWishlist(product.id, !isInWishlist);
                if (externalIsInWishlist === undefined) {
                    setInternalIsInWishlist(!isInWishlist);
                }
            } else {
                if (isInWishlist) {
                    await fetch(API_URLS.WISHLIST.BY_PRODUCT_ID(product.id), {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (showAlert) alert(`Товар "${product.name}" удален из избранного`);
                } else {
                    await fetch(API_URLS.WISHLIST.BASE, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ productId: product.id })
                    });
                    if (showAlert) alert(`Товар "${product.name}" добавлен в избранное!`);
                }
                setInternalIsInWishlist(!isInWishlist);
            }
        } catch (error) {
            console.error('Ошибка обновления избранного:', error);
            alert('Ошибка при обновлении избранного');
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = () => {
        if (onViewDetails) {
            onViewDetails(product);
        }
    };

    const handleAddToCart = () => {
        if (onAddToCart) {
            onAddToCart(product);
            if (showAlert) {
                alert(`Товар "${product.name}" добавлен в корзину!`);
            }
        }
    };

    const handleViewReviews = () => {
        navigate(`/product-reviews/${product.id}`);
    };

    const gallery =
        product.images && product.images.length > 0
            ? product.images
            : product.image_url
              ? [product.image_url]
              : [];
    const coverSrc = gallery[0];
    const photoCount = gallery.length;

    return (
        <div
            className={`product-card ${className} ${layout} ${product.stock === 0 ? 'product-card--out' : ''}`}
        >
            {showWishlistButton && (
                <div className="product-card-header">
                    <button 
                        className={`wishlist-btn ${isInWishlist ? 'active' : ''}`}
                        onClick={handleWishlistToggle}
                        disabled={isLoading}
                        title={isInWishlist ? "Удалить из избранного" : "Добавить в избранное"}
                    >
                        {isLoading ? '...' : (isInWishlist ? '❤️' : '🤍')}
                    </button>
                </div>
            )}
            
            <div className="product-image" onClick={handleViewDetails}>
                {coverSrc ? (
                    <img src={coverSrc} alt={product.name} className="product-img" />
                ) : (
                    <div className="image-placeholder">{product.name.charAt(0)}</div>
                )}
                {photoCount > 1 && <span className="product-photo-badge">{photoCount} фото</span>}
            </div>
            
            <div className="product-content">
                <h3 onClick={handleViewDetails} className="product-title">
                    {product.name}
                </h3>
                
                <div className="product-rating-row">
                    <StarRating rating={product.avg_rating || 0} readonly={true} size="small" />
                    <span className="reviews-count-link" onClick={handleViewReviews}>
                        ({product.reviews_count || 0} отзывов)
                    </span>
                </div>
                
                {showCategory && (
                    <p className="product-category">{product.category}</p>
                )}
                
                {showDescription && (
                    <div className="product-description">
                        {product.description}
                    </div>
                )}
                
                <div className="product-footer">
                    <div className="price-stock">
                        <div className="price-container">
                            {product.has_discount ? (
                                <div className="price-with-discount">
                                    <span className="original-price">
                                        {product.price.toLocaleString()} ₽
                                    </span>
                                    <span className="final-price">
                                        {product.final_price?.toLocaleString()} ₽
                                    </span>
                                    <span className="discount-percent-badge">
                                        -{product.discount_percent}%
                                    </span>
                                </div>
                            ) : (
                                <span className="product-price">
                                    {product.price.toLocaleString()} ₽
                                </span>
                            )}
                        </div>
                        <span className={`product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                            {product.stock > 0 ? 'В наличии' : 'Нет в наличии'}
                        </span>
                    </div>
                    
                    <div className="product-actions">
                        {showAddToCartButton && onAddToCart && (
                            <button 
                                onClick={handleAddToCart}
                                className="add-to-cart-btn"
                                disabled={product.stock === 0}
                            >
                                🛒 В корзину
                            </button>
                        )}
                        
                        <button 
                            onClick={handleViewReviews}
                            className="reviews-btn"
                            title="Посмотреть отзывы"
                        >
                            ★ Отзывы
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;