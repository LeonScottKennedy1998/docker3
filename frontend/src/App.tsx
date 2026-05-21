import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import MerchandiserDashboard from './components/merchandiser/MerchandiserDashboard';
import AnalystDashboard from './components/analyst/AnalystDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import EditProfile from './components/profile/EditProfile';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import OrderSuccess from './components/order/OrderSuccess';
import { CartItem } from './types/product';
import WishlistPage from './components/wishlist/WishlistPage';
import CartPage from './components/cart/CartPage';
import ProcurementDashboard   from './components/procurement/ProcurementDashboard';
import PrivacyPolicy from './components/privacy/PrivacyPolicy';
import UserManual from './components/manuals/UserManual';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import CatalogPage from './components/common/CatalogPage';
import OrdersPage from './components/order/OrdersPage';
import HomePage from './components/common/HomePage';
import MyReviewsPage from './components/reviews/MyReviewsPage';
import ProductReviewsPage from './components/reviews/ProductReviewsPage';

import './App.css';
import type { AddToCartPayload, SessionUser } from './types/app';
import type { ThemeRouteSyncProps } from './types/props';
import {
    cartNeedsReplaceFromServer,
    fetchServerCart,
    mergeGuestCartWithServer,
    putServerCart,
    readGuestCart,
    userCartCacheKey,
    writeGuestCart,
} from './utils/serverCart';

function ThemeRouteSync({ user }: ThemeRouteSyncProps) {
    const location = useLocation();
    useEffect(() => {
        const path = location.pathname;
        const authPublic =
            path === '/login' ||
            path === '/register' ||
            path === '/forgot-password' ||
            path.startsWith('/reset-password/');
        if (authPublic) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            const theme = user && user.theme === 'dark' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
        }
    }, [user, location.pathname]);
    return null;
}

function App() {
    const [user, setUser] = useState<SessionUser | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const token = localStorage.getItem('token');
            const raw = localStorage.getItem('user');
            const u = raw ? (JSON.parse(raw) as SessionUser) : null;
            if (token && u?.id) {
                const ck = localStorage.getItem(userCartCacheKey(u.id));
                return ck ? JSON.parse(ck) : [];
            }
            return readGuestCart();
        } catch {
            return [];
        }
    });

    
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const uid = user?.id;
        if (!token || !uid) {
            writeGuestCart(cart);
            return;
        }
        const t = window.setTimeout(() => {
            putServerCart(token, cart)
                .then((items) => {
                    localStorage.setItem(userCartCacheKey(uid), JSON.stringify(items));
                    if (cartNeedsReplaceFromServer(cart, items)) {
                        setCart(items);
                    }
                })
                .catch(() => {});
        }, 550);
        return () => window.clearTimeout(t);
    }, [cart, user?.id]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const uid = user?.id;
        if (!token || !uid) return;
        let cancelled = false;
        void (async () => {
            try {
                const items = await fetchServerCart(token);
                if (cancelled) return;
                setCart(items);
                localStorage.setItem(userCartCacheKey(uid), JSON.stringify(items));
            } catch {
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
    const handleCartUpdate = (event: Event) => {
        const newCart = (event as CustomEvent<CartItem[]>).detail;
        setCart(newCart);
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    
    return () => {
        window.removeEventListener('cartUpdated', handleCartUpdate);
    };
    }, []);

    const handleLogin = async (userData: SessionUser) => {
        const token = localStorage.getItem('token');
        let merged: CartItem[] | null = null;
        if (token && userData.id) {
            try {
                merged = await mergeGuestCartWithServer(token, cart);
            } catch {
                merged = null;
            }
        }
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        if (merged) {
            setCart(merged);
            if (userData.id) {
                localStorage.setItem(userCartCacheKey(userData.id), JSON.stringify(merged));
            }
        }
    };

    const handleLogout = () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
        const uid = user?.id;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (uid) {
            localStorage.removeItem(userCartCacheKey(uid));
        }
        setUser(null);
        setCart([]);
        setIsMenuOpen(false);
        window.location.href = '/login';
    }
    };


    const addToCart = (product: AddToCartPayload, showAlert: boolean = true) => {
        const stock = typeof product.stock === 'number' ? product.stock : undefined;
        if (stock !== undefined && stock <= 0) {
            if (showAlert) alert('Товар закончился, заказ сейчас невозможен.');
            return;
        }

        const pid = product.productId ?? product.id;
        if (pid == null) return;
        const unitPrice: number =
            product.has_discount && product.final_price != null
                ? product.final_price
                : product.price;
        const addQty = Math.max(1, product.quantity ?? 1);
        const maxQty = stock ?? Number.POSITIVE_INFINITY;

        const existingItemIndex = cart.findIndex((item) => item.productId === pid);

        if (existingItemIndex > -1) {
            const updatedCart = [...cart];
            const nextQty = Math.min(updatedCart[existingItemIndex].quantity + addQty, maxQty);
            if (nextQty === updatedCart[existingItemIndex].quantity && stock !== undefined) {
                if (showAlert) alert('Больше нет в наличии на складе.');
                return;
            }
            updatedCart[existingItemIndex] = {
                ...updatedCart[existingItemIndex],
                quantity: nextQty,
                price: unitPrice,
                stock
            };
            setCart(updatedCart);
        } else {
            const q = Math.min(addQty, maxQty);
            if (q < 1) {
                if (showAlert) alert('Товар закончился');
                return;
            }
            setCart([
                ...cart,
                {
                    productId: pid,
                    name: product.name,
                    price: unitPrice,
                    quantity: q,
                    stock
                }
            ]);
        }
    };



    const updateCart = (newCart: CartItem[]) => {
        setCart(newCart);
    };

    const clearCart = () => {
        setCart([]);
    };

    const removeFromCart = (productId: number) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    const updateQuantity = (productId: number, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(productId);
            return;
        }
        
        setCart(cart.map(item => {
            if (item.productId !== productId) {
                return item;
            }

            const maxQty = typeof item.stock === 'number' ? item.stock : Number.POSITIVE_INFINITY;
            return { ...item, quantity: Math.min(quantity, maxQty) };
        }));
    };

    useEffect(() => {
        const handleUserUpdate = (event: Event) => {
            const updatedUser = (event as CustomEvent<SessionUser>).detail;
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        };

        window.addEventListener('userUpdated', handleUserUpdate);
        
        return () => {
            window.removeEventListener('userUpdated', handleUserUpdate);
        };
    }, []);

    const isMerchandiser = user?.role === 'Товаровед';
    const isAnalyst = user?.role === 'Аналитик';
    const isAdmin = user?.role === 'Администратор';

    return (
        <BrowserRouter>
            <ThemeRouteSync user={user} />
            <div className="App">
                <nav className="navbar">
                    <div className="nav-brand">
                        <Link to="/" onClick={() => setIsMenuOpen(false)}>
                            <img 
                                src="/logo.png" 
                                alt="Магазин мерча" 
                                style={{ 
                                    height: '40px', 
                                    width: 'auto', 
                                    marginRight: '10px',
                                    verticalAlign: 'middle'
                                }}
                            />
                            Магазин мерча
                        </Link>
                        
                        <button 
                            className="menu-toggle"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label="Меню"
                        >
                            {isMenuOpen ? '✕' : '☰'}
                        </button>
                    </div>
                    
                    <div className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
                        <Link to="/" onClick={() => setIsMenuOpen(false)}>Главная</Link>
                        
                        {user ? (
                            <>
                                {isAdmin ? (
                                    <Link to="/admin" onClick={() => setIsMenuOpen(false)}>Панель администратора</Link>
                                ) : isMerchandiser ? (
                                    <Link to="/merchandiser" onClick={() => setIsMenuOpen(false)}>Панель товароведа</Link>
                                ) : isAnalyst ? (
                                    <Link to="/analyst" onClick={() => setIsMenuOpen(false)}>Панель аналитика</Link>
                                ) : user.role === 'Менеджер по закупкам' ? (
                                    <Link to="/procurement" onClick={() => setIsMenuOpen(false)}>Панель закупок</Link>
                                ) : (
                                    <>
                                        <Link to="/catalog" onClick={() => setIsMenuOpen(false)}>Каталог</Link>
                                        <Link to="/cart" className="cart-link" onClick={() => setIsMenuOpen(false)}>
                                            Корзина 
                                            {cart.length > 0 && (
                                                <span className="cart-count">{cart.length}</span>
                                            )}
                                        </Link>
                                        <Link to="/wishlist" className="wishlist-link" onClick={() => setIsMenuOpen(false)}>
                                            Избранное
                                        </Link>
                                        <Link to="/orders" onClick={() => setIsMenuOpen(false)}>Мои заказы</Link>
                                        <Link to="/my-reviews">Мои отзывы</Link>
                                    </>
                                )}
                                <Link to="/profile/edit" className="profile-link" onClick={() => setIsMenuOpen(false)}>
                                    Профиль
                                </Link>
                                <Link to="/user-manual" className="manual-link" onClick={() => setIsMenuOpen(false)}>
                                    Руководство
                                </Link>
                                
                                <div className="nav-divider"></div>
                                
                                <span className="user-greeting">
                                    {user.first_name} {user.last_name}
                                </span>
                                <button onClick={handleLogout} className="logout-btn">
                                    Выйти
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/catalog" onClick={() => setIsMenuOpen(false)}>Каталог</Link>
                                <Link to="/login" onClick={() => setIsMenuOpen(false)}>Вход</Link>
                                <Link to="/register" onClick={() => setIsMenuOpen(false)}>Регистрация</Link>
                            </>
                        )}
                    </div>
                </nav>
                          
                <div className="main-content">
                    <Routes>
                        <Route path="/" element={
                            <HomePage user={user} onLogout={handleLogout} />
                        } />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/login" element={
                            <LoginPage onLogin={handleLogin} />
                        } />
                        <Route path="/catalog" element={
                            <CatalogPage addToCart={(product) => addToCart(product, true)} />

                        } />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                        <Route path="/cart" element={
                            <CartPage 
                                cart={cart} 
                                updateCart={updateCart}
                                clearCart={clearCart}
                                removeFromCart={removeFromCart}
                                updateQuantity={updateQuantity}
                                user={user}
                            />
                        } />
                        <Route path="/wishlist" element={
                            <WishlistPage addToCart={addToCart} />
                        } />
                        <Route path="/order-success/:id" element={
                            user ? (
                                <OrderSuccess />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="/product-reviews/:productId" element={<ProductReviewsPage />} />
                        <Route path="/my-reviews" element={<MyReviewsPage />} />

                        
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password/:token" element={<ResetPassword />} />
                        
                        <Route path="/profile/edit" element={
                            user ? (
                                <EditProfile />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                       <Route path="/procurement/orders" element={
                            user?.role === 'Менеджер по закупкам' ? 
                                <ProcurementDashboard defaultTab="orders" /> : 
                                <HomePage user={user} onLogout={() => {
                                    localStorage.removeItem('user');
                                    setUser(null);
                                }} />
                        } />

                        <Route path="/procurement/suppliers" element={
                            user?.role === 'Менеджер по закупкам' ? 
                                <ProcurementDashboard defaultTab="suppliers" /> : 
                                <HomePage user={user} onLogout={() => {
                                    localStorage.removeItem('user');
                                    setUser(null);
                                }} />
                        } />

                        <Route path="/procurement/stock" element={
                            user?.role === 'Менеджер по закупкам' ? 
                                <ProcurementDashboard defaultTab="stock" /> : 
                                <HomePage user={user} onLogout={() => {
                                    localStorage.removeItem('user');
                                    setUser(null);
                                }} />
                        } />

                        <Route path="/procurement" element={
                            user?.role === 'Менеджер по закупкам' ? 
                                <Navigate to="/procurement/orders" replace /> : 
                                <HomePage user={user} onLogout={() => {
                                    localStorage.removeItem('user');
                                    setUser(null);
                                }} />
                        } />

                        <Route path="/merchandiser/orders" element={
                            isMerchandiser ? (
                                <MerchandiserDashboard defaultTab="orders" />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/merchandiser/analytics" element={
                            isMerchandiser ? (
                                <MerchandiserDashboard defaultTab="analytics" />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/merchandiser/products" element={
                            isMerchandiser ? (
                                <MerchandiserDashboard defaultTab="products" />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/merchandiser" element={
                            isMerchandiser ? (
                                <Navigate to="/merchandiser/orders" replace />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/analyst" element={
                            isAnalyst ? (
                                <AnalystDashboard />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/admin/users" element={
                            isAdmin ? (
                                <AdminDashboard defaultTab="users" />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/admin/audit" element={
                            isAdmin ? (
                                <AdminDashboard defaultTab="audit" />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/admin/backup" element={
                            isAdmin ? (
                                <AdminDashboard defaultTab="backup" />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/admin" element={
                            isAdmin ? (
                                <Navigate to="/admin/users" replace />
                            ) : user ? (
                                <HomePage user={user} onLogout={handleLogout} />
                            ) : (
                                <LoginPage onLogin={handleLogin} />
                            )
                        } />

                        <Route path="/user-manual" element={
                            user ? (
                                <UserManual />
                            ) : (
                                <Navigate to="/login" />
                            )
                        } />
                    </Routes>

                    
                </div>

                <footer className="footer">
                    <p>© 2025 Магазин мерча. Система заказов товаров с символикой Московского Приборостроительного Техникума</p>
                    <p>Производственная практика | Все права защищены</p>
                </footer>
            </div>
        </BrowserRouter>
    );
}


export default App;