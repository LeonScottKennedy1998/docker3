import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { CartPageProps } from '../../types/props';
import type { CartItem } from '../../types/product';
import {
    PHONE_COUNTRY_CODES,
    buildInternationalPhone,
    digitsOnly,
    getMaxLocalPhoneLength,
    isValidInternationalPhone,
    normalizePhoneParts,
} from '../../utils/phone';

const CartPage: React.FC<CartPageProps> = ({ 
    cart, 
    clearCart, 
    removeFromCart, 
    updateQuantity,
    user 
}) => {
    const initialPhone = normalizePhoneParts(user?.phone || '');
    const [phoneCountryCode, setPhoneCountryCode] = useState(initialPhone.countryCode);
    const [phoneLocalNumber, setPhoneLocalNumber] = useState(initialPhone.localNumber);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productsData, setProductsData] = useState<Map<number, any>>(new Map());
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const normalizedPhone = buildInternationalPhone(phoneCountryCode, phoneLocalNumber);

    useEffect(() => {
        if (cart.length > 0) {
            fetchProductsData();
        }
    }, [cart]);

    useEffect(() => {
        if (user?.phone) {
            const parts = normalizePhoneParts(user.phone);
            setPhoneCountryCode(parts.countryCode);
            setPhoneLocalNumber(parts.localNumber);
        }
    }, [user]);

    const fetchProductsData = async () => {
        try {
            const productIds = cart.map(item => item.productId);
            
            const response = await fetch(API_URLS.PRODUCTS.BATCH, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ productIds })
            });

            if (response.ok) {
                const data = await response.json();
                const productsMap = new Map();
                data.forEach((product: any) => {
                    productsMap.set(product.id, product);
                });
                setProductsData(productsMap);
            }
        } catch (error) {
            console.error('Ошибка загрузки информации о товарах:', error);
        }
    };

    const getProductData = (productId: number) => {
        const cartItem = cart.find(item => item.productId === productId);
        return productsData.get(productId) || { 
            price: cartItem?.price || 0,
            stock: cartItem?.stock,
            has_discount: false
        };
    };

    const getAvailableStock = (item: CartItem) => {
        const stock = getProductData(item.productId).stock ?? item.stock;
        return typeof stock === 'number' ? stock : undefined;
    };

    const handlePhoneCountryCodeChange = (value: string) => {
        const countryCode = value.startsWith('+') ? value : `+${digitsOnly(value)}`;
        setPhoneCountryCode(countryCode);
        setPhoneLocalNumber((current) => digitsOnly(current).slice(0, getMaxLocalPhoneLength(countryCode)));
    };

    const handlePhoneLocalChange = (value: string) => {
        setPhoneLocalNumber(digitsOnly(value).slice(0, getMaxLocalPhoneLength(phoneCountryCode)));
    };

    const handleQuantityChange = (item: CartItem, quantity: number) => {
        if (quantity < 1) {
            updateQuantity(item.productId, quantity);
            return;
        }

        const stock = getAvailableStock(item);
        if (stock !== undefined && quantity > stock) {
            alert(`На складе доступно только ${stock} шт.`);
            updateQuantity(item.productId, stock);
            return;
        }

        updateQuantity(item.productId, quantity);
    };

    const calculateItemPrice = (item: CartItem) => {
        const productData = getProductData(item.productId);
        
        if (productData.has_discount && productData.final_price) {
            return productData.final_price;
        }
        
        return item.price;
    };

    const calculateItemTotal = (item: CartItem) => {
        const price = calculateItemPrice(item);
        return price * item.quantity;
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + calculateItemTotal(item), 0);
    };
    
    const handleSubmitOrder = async () => {
        if (!token) {
            alert('Для оформления заказа необходимо войти в систему');
            navigate('/login');
            return;
        }

        if (cart.length === 0) {
            alert('Корзина пуста');
            return;
        }

        if (!phoneLocalNumber.trim()) {
            alert('Введите телефон для связи');
            return;
        }

        if (!isValidInternationalPhone(phoneCountryCode, phoneLocalNumber)) {
            alert('Введите корректный номер телефона');
            return;
        }

        const unavailableItem = cart.find((item) => {
            const stock = getAvailableStock(item);
            return stock !== undefined && item.quantity > stock;
        });

        if (unavailableItem) {
            const stock = getAvailableStock(unavailableItem) || 0;
            alert(`Количество "${unavailableItem.name}" превышает остаток на складе (${stock} шт.).`);
            updateQuantity(unavailableItem.productId, stock);
            return;
        }

        setIsSubmitting(true);

        try {
            const orderData = {
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                })),
                phone: normalizedPhone
            };

            const response = await fetch(API_URLS.ORDERS.CREATE, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(orderData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка оформления заказа');
            }

            clearCart();
            navigate(`/order-success/${data.order.id}`);

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (cart.length === 0) {
        return (
            <div className="page">
                <h1>Корзина</h1>
                <div className="empty-cart">
                    <p>Ваша корзина пуста</p>
                    <Link to="/catalog">
                        <button className="cta-button">Перейти к каталогу</button>
                    </Link>
                </div>
            </div>
        );
    }

    const originalTotal = cart.reduce((total, item) => {
        const productData = getProductData(item.productId);
        const originalPrice = productData.original_price || item.price;
        return total + (originalPrice * item.quantity);
    }, 0);
    
    const finalTotal = calculateTotal();
    const savedAmount = originalTotal - finalTotal;

    return (
        <div className="page">
            <h1>Корзина</h1>
            
            <div className="cart-container">
                <div className="cart-items">
                    <table className="cart-table">
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th>Цена</th>
                                <th>Количество</th>
                                <th>Сумма</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map(item => {
                                const productData = getProductData(item.productId);
                                const itemPrice = calculateItemPrice(item);
                                const itemTotal = calculateItemTotal(item);
                                const availableStock = getAvailableStock(item);
                                const isMaxQuantity = availableStock !== undefined && item.quantity >= availableStock;
                                
                                return (
                                    <tr key={item.productId}>
                                        <td>
                                            <div className="cart-item-name">
                                                {item.name}
                                                {productData.has_discount && (
                                                    <span className="cart-discount-badge">
                                                        -{productData.discount_percent}%
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {productData.has_discount ? (
                                                <div className="cart-price-container">
                                                    <span className="cart-original-price">
                                                        {item.price.toLocaleString()} ₽
                                                    </span>
                                                    <span className="cart-final-price">
                                                        {itemPrice.toLocaleString()} ₽
                                                    </span>
                                                </div>
                                            ) : (
                                                <span>{itemPrice.toLocaleString()} ₽</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="quantity-control">
                                                <button 
                                                    onClick={() => handleQuantityChange(item, item.quantity - 1)}
                                                    className="quantity-btn"
                                                >
                                                    -
                                                </button>
                                                <span>{item.quantity}</span>
                                                <button 
                                                    onClick={() => handleQuantityChange(item, item.quantity + 1)}
                                                    className="quantity-btn"
                                                    disabled={isMaxQuantity}
                                                    title={isMaxQuantity ? `На складе ${availableStock} шт.` : undefined}
                                                >
                                                    +
                                                </button>
                                            </div>
                                            {availableStock !== undefined && (
                                                <span className="stock-limit-note">
                                                    Доступно: {availableStock} шт.
                                                </span>
                                            )}
                                        </td>
                                        <td>{itemTotal.toLocaleString()} ₽</td>
                                        <td>
                                            <button 
                                                onClick={() => removeFromCart(item.productId)}
                                                className="remove-btn"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    <div className="cart-actions">
                        <button onClick={clearCart} className="secondary-btn">
                            Очистить корзину
                        </button>
                        <Link to="/catalog">
                            <button className="secondary-btn">
                                Продолжить покупки
                            </button>
                        </Link>
                    </div>
                </div>
                
                <div className="cart-summary">
                    <h3>Итог заказа</h3>
                    
                    <div className="summary-row">
                        <span>Товаров:</span>
                        <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} шт.</span>
                    </div>
                    
                    {savedAmount > 0 && (
                        <>
                            <div className="summary-row">
                                <span>Скидка:</span>
                                <span className="saved-amount">-{savedAmount.toLocaleString()} ₽</span>
                            </div>
                            <div className="summary-row original-total">
                                <span>Без скидки:</span>
                                <span className="strikethrough">{originalTotal.toLocaleString()} ₽</span>
                            </div>
                        </>
                    )}
                    
                    <div className="summary-row">
                        <span>Общая сумма:</span>
                        <span className="total-amount">{finalTotal.toLocaleString()} ₽</span>
                    </div>
                    
                    <div className="form-group">
                        <label>Телефон для связи *</label>
                        <div className="phone-input-row">
                            <input
                                className="country-code-input"
                                type="tel"
                                inputMode="numeric"
                                list="cart-phone-country-codes"
                                value={phoneCountryCode}
                                onChange={(e) => handlePhoneCountryCodeChange(e.target.value)}
                                aria-label="Код страны"
                                maxLength={4}
                            />
                            <datalist id="cart-phone-country-codes">
                                {PHONE_COUNTRY_CODES.map((code) => (
                                    <option key={code} value={code} />
                                ))}
                            </datalist>
                            <input
                                type="tel"
                                inputMode="numeric"
                                value={phoneLocalNumber}
                                onChange={(e) => handlePhoneLocalChange(e.target.value)}
                                placeholder="9991234567"
                                maxLength={getMaxLocalPhoneLength(phoneCountryCode)}
                                required
                            />
                        </div>
                        <span className="phone-preview">Будет сохранено как {normalizedPhone || `${phoneCountryCode}...`}</span>
                        {user?.phone && normalizedPhone === buildInternationalPhone(normalizePhoneParts(user.phone).countryCode, normalizePhoneParts(user.phone).localNumber) && (
                            <span className="phone-info">
                                (телефон из вашего профиля)
                            </span>
                        )}
                    </div>
                    
                    <button 
                        onClick={handleSubmitOrder}
                        className="cta-button"
                        disabled={isSubmitting || !phoneLocalNumber.trim()}
                    >
                        {isSubmitting ? 'Оформление...' : 'Оформить заказ'}
                    </button>
                    
                    <p className="order-note">
                        После оформления заказа с вами свяжется наш сотрудник для подтверждения.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CartPage;