import React, { useEffect, useState } from 'react';
import { Product } from '../../types/product';
import { useNavigate } from 'react-router-dom';
import StarRating from '../reviews/StarRating';
import './ProductModal.css';
import type { ProductModalProps } from '../../types/props';

const ProductModal: React.FC<ProductModalProps> = ({
    product,
    isOpen,
    onClose,
    onAddToCart
}) => {
    const navigate = useNavigate();
    const [activeImg, setActiveImg] = useState(0);

    useEffect(() => {
        setActiveImg(0);
    }, [product?.id, isOpen]);

    if (!isOpen || !product) return null;

    const hasDiscount = product.has_discount && product.discount_percent && product.discount_percent > 0;
    const finalPrice = hasDiscount && product.final_price ? product.final_price : product.price;
    const discountPercent = product.discount_percent || 0;

    const gallery =
        product.images && product.images.length > 0
            ? product.images
            : product.image_url
              ? [product.image_url]
              : [];

    const mainSrc = gallery.length ? gallery[Math.min(activeImg, gallery.length - 1)] : undefined;

    const extraEntries = Object.entries(product.extra_info || {});

    const handleViewReviews = () => {
        onClose();
        navigate(`/product-reviews/${product.id}`);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>
                    ✕
                </button>

                <div className="product-modal">
                    <div className="product-modal-gallery">
                        <div className="product-modal-image">
                            {mainSrc ? (
                                <img src={mainSrc} alt={product.name} className="modal-img" />
                            ) : (
                                <div className="modal-image-placeholder">
                                    <span>{product.name.charAt(0)}</span>
                                </div>
                            )}
                        </div>
                        {gallery.length > 1 && (
                            <div className="modal-thumb-strip" role="tablist" aria-label="Фотографии товара">
                                {gallery.map((src, idx) => (
                                    <button
                                        key={`${src}-${idx}`}
                                        type="button"
                                        className={`modal-thumb ${idx === activeImg ? 'active' : ''}`}
                                        onClick={() => setActiveImg(idx)}
                                        aria-current={idx === activeImg}
                                    >
                                        <img src={src} alt="" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="product-modal-info">
                        <h2>{product.name}</h2>

                        <div className="modal-rating-row">
                            <StarRating rating={product.avg_rating || 0} readonly={true} size="small" />
                            <span className="modal-reviews-link" onClick={handleViewReviews}>
                                {product.reviews_count || 0} отзывов
                            </span>
                        </div>

                        <div className="modal-category">
                            Категория: <strong>{product.category}</strong>
                        </div>

                        {extraEntries.length > 0 && (
                            <div className="modal-extra-block">
                                <h3>Характеристики</h3>
                                <dl className="modal-extra-dl">
                                    {extraEntries.map(([k, v]) => (
                                        <div key={k} className="modal-extra-row">
                                            <dt>{k}</dt>
                                            <dd>{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}

                        <div className="modal-description">
                            <h3>Описание</h3>
                            <p>{product.description || 'Описание отсутствует'}</p>
                        </div>

                        <div className="modal-details">
                            <div className="detail-row">
                                <span>Цена:</span>
                                <div className="modal-price-container">
                                    {hasDiscount ? (
                                        <div className="discount-price-block">
                                            <span className="modal-original-price">{product.price.toLocaleString()} ₽</span>
                                            <span className="modal-final-price">{finalPrice.toLocaleString()} ₽</span>
                                        </div>
                                    ) : (
                                        <span className="modal-price-normal">{product.price.toLocaleString()} ₽</span>
                                    )}
                                </div>
                            </div>

                            <div className="detail-row">
                                <span>В наличии:</span>
                                <span className={`modal-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                    {product.stock > 0 ? `${product.stock} шт.` : 'Нет в наличии'}
                                </span>
                            </div>

                            {hasDiscount && (
                                <div className="detail-row">
                                    <span>Скидка:</span>
                                    <span className="discount-text">-{discountPercent}%</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                onClick={() => {
                                    onAddToCart(product);
                                    onClose();
                                }}
                                className="modal-add-to-cart-btn"
                                disabled={product.stock === 0}
                            >
                                {product.stock === 0 ? 'Товар закончился' : 'Добавить в корзину'}
                            </button>
                            <button onClick={handleViewReviews} className="modal-reviews-btn">
                                ★ Отзывы ({product.reviews_count || 0})
                            </button>
                            <button onClick={onClose} className="modal-close-action-btn">
                                Назад
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductModal;
