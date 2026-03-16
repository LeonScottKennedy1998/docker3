import React, { useState, useEffect } from 'react';
import './Merchandiser.css';
import { Product, Category, DiscountRule } from '../../types/product';
import { API_URLS, getAuthHeaders } from '../../config/api';

interface FormData {
    name: string;
    description: string;
    price: string;
    category_id: string;
    image_url: string;
    is_active: boolean;
    stock: string;
}

interface CategoryFormData {
    category_name: string;
    description: string;
}

const ProductManagement = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'discounts' | 'rules'>('products');
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [discounts, setDiscounts] = useState<any[]>([]);
    const [rules, setRules] = useState<DiscountRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Фильтры и поиск
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [stockFilter, setStockFilter] = useState<string>('all');
    
    const [showAddForm, setShowAddForm] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [selectedProductForDiscount, setSelectedProductForDiscount] = useState<Product | null>(null);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [applyingRule, setApplyingRule] = useState<number | null>(null);
    const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    
    const [formData, setFormData] = useState<FormData>({
        name: '',
        description: '',
        price: '',
        category_id: '',
        image_url: '',
        is_active: true,
        stock: '0'
    });

    const [categoryFormData, setCategoryFormData] = useState<CategoryFormData>({
        category_name: '',
        description: ''
    });

    const [discountForm, setDiscountForm] = useState({
        discount_percent: '',
        end_date: ''
    });

    const [ruleForm, setRuleForm] = useState({
        rule_name: '',
        rule_type: 'category' as 'category' | 'stock' | 'age' | 'price_range' | 'seasonal' | 'new_arrivals',
        condition_value: {} as any,
        discount_percent: '',
        priority: 1,
        end_date: ''
    });

    // Фильтрация товаров
    useEffect(() => {
        let filtered = [...products];
        
        // Поиск по названию и описанию
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(product => 
                product.name.toLowerCase().includes(query) ||
                (product.description && product.description.toLowerCase().includes(query)) ||
                product.category?.toLowerCase().includes(query)
            );
        }
        
        // Фильтр по категории
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(product => product.category === categoryFilter);
        }
        
        // Фильтр по статусу
        if (statusFilter !== 'all') {
            filtered = filtered.filter(product => 
                statusFilter === 'active' ? product.is_active : !product.is_active
            );
        }
        
        // Фильтр по остатку
        if (stockFilter !== 'all') {
            if (stockFilter === 'in-stock') {
                filtered = filtered.filter(product => product.stock > 0);
            } else if (stockFilter === 'out-of-stock') {
                filtered = filtered.filter(product => product.stock === 0);
            } else if (stockFilter === 'low-stock') {
                filtered = filtered.filter(product => product.stock > 0 && product.stock <= 5);
            }
        }
        
        setFilteredProducts(filtered);
    }, [products, searchQuery, categoryFilter, statusFilter, stockFilter]);

    const fetchProducts = async () => {
        try {
            const response = await fetch(API_URLS.PRODUCTS.ALL, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Ошибка загрузки товаров');
            
            const data = await response.json();
            setProducts(data);
            setFilteredProducts(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch(API_URLS.PRODUCTS.CATEGORIES);
            const data = await response.json();
            setCategories(data);
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
        }
    };

    const fetchDiscounts = async () => {
        try {
            const response = await fetch(API_URLS.DISCOUNTS.BASE, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Ошибка загрузки скидок');
            
            const data = await response.json();
            setDiscounts(data);
        } catch (err: any) {
            console.error('Ошибка загрузки скидок:', err);
        }
    };

    const fetchRules = async () => {
        try {
            const response = await fetch(API_URLS.DISCOUNTS.RULES, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Ошибка загрузки правил');
            
            const data = await response.json();
            setRules(data);
        } catch (err: any) {
            console.error('Ошибка загрузки правил:', err);
        }
    };

    // Функции для работы с категориями
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.CATEGORIES, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    category_name: categoryFormData.category_name,
                    description: categoryFormData.description || null
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка создания категории');
            
            alert('Категория успешно создана!');
            setShowCategoryForm(false);
            setCategoryFormData({ category_name: '', description: '' });
            fetchCategories();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.UPDATE_CATEGORY(editingCategory.category_id), {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    category_name: categoryFormData.category_name,
                    description: categoryFormData.description || null
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка обновления категории');
            
            alert('Категория успешно обновлена!');
            setShowCategoryForm(false);
            setEditingCategory(null);
            setCategoryFormData({ category_name: '', description: '' });
            fetchCategories();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteCategory = async (categoryId: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить категорию? Товары в этой категории останутся без категории.')) return;
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.DELETE_CATEGORY(categoryId), {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка удаления категории');
            
            alert('Категория успешно удалена!');
            fetchCategories();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const startEditCategory = (category: Category) => {
        setEditingCategory(category);
        setCategoryFormData({
            category_name: category.category_name,
            description: category.description || ''
        });
        setShowCategoryForm(true);
    };

    // Остальные функции управления товарами (без изменений)
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.BASE, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    price: parseFloat(formData.price),
                    category_id: parseInt(formData.category_id),
                    stock: parseInt(formData.stock) || 0,
                    image_url: formData.image_url || undefined
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка создания товара');
            
            alert(`Товар успешно создан! Остаток: ${parseInt(formData.stock) || 0}.`);
            setShowAddForm(false);
            setFormData({
                name: '',
                description: '',
                price: '',
                category_id: '',
                stock: '0',
                image_url: '',
                is_active: true
            });
            fetchProducts();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleUpdateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.UPDATE(editingProduct.id), {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    price: parseFloat(formData.price),
                    category_id: parseInt(formData.category_id),
                    stock: parseInt(formData.stock),
                    image_url: formData.image_url || undefined,
                    is_active: formData.is_active
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка обновления товара');
            
            alert('Товар успешно обновлен!');
            setEditingProduct(null);
            setFormData({
                name: '',
                description: '',
                price: '',
                category_id: '',
                stock: '0',
                image_url: '',
                is_active: true
            });
            fetchProducts();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleSetDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProductForDiscount) return;
        
        try {
            const response = await fetch(
                API_URLS.DISCOUNTS.PRODUCT_DISCOUNT(selectedProductForDiscount.id), 
                {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        discount_percent: parseFloat(discountForm.discount_percent),
                        end_date: discountForm.end_date || null
                    })
                }
            );

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка установки скидки');
            
            alert('Скидка успешно установлена!');
            setShowDiscountModal(false);
            setSelectedProductForDiscount(null);
            setDiscountForm({
                discount_percent: '',
                end_date: ''
            });
            fetchDiscounts();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRemoveDiscount = async (productId: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить скидку?')) return;
        
        try {
            const response = await fetch(
                API_URLS.DISCOUNTS.REMOVE_PRODUCT_DISCOUNT(productId), 
                {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                }
            );

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка удаления скидки');
            
            alert('Скидка успешно удалена!');
            fetchDiscounts();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRemoveRuleDiscounts = async (ruleId: number) => {
        if (!window.confirm('Удалить все скидки, созданные этим правилом?')) return;
        
        try {
            const response = await fetch(
                API_URLS.DISCOUNTS.REMOVE_RULE_DISCOUNTS(ruleId), 
                {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                }
            );

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка удаления скидок');
            
            alert(`Удалено ${data.removed_count} скидок`);
            fetchDiscounts();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCreateRule = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const ruleData: any = {
                rule_name: ruleForm.rule_name,
                rule_type: ruleForm.rule_type,
                discount_percent: parseFloat(ruleForm.discount_percent) || 0,
                priority: parseInt(String(ruleForm.priority)) || 1,
            };
            
            if (ruleForm.condition_value && Object.keys(ruleForm.condition_value).length > 0) {
                ruleData.condition_value = ruleForm.condition_value;
            }
            
            if (ruleForm.end_date) {
                ruleData.end_date = ruleForm.end_date;
            }
            
            const response = await fetch(API_URLS.DISCOUNTS.RULES, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(ruleData)
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка создания правила');
            
            alert('Правило успешно создано!');
            setShowRuleForm(false);
            setRuleForm({
                rule_name: '',
                rule_type: 'category',
                condition_value: {},
                discount_percent: '',
                priority: 1,
                end_date: ''
            });
            fetchRules();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleApplyRule = async (ruleId: number) => {
        if (!window.confirm('Применить правило? Существующие скидки могут быть перезаписаны.')) return;
        
        setApplyingRule(ruleId);
        
        try {
            const response = await fetch(API_URLS.DISCOUNTS.APPLY_RULE(ruleId), {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка применения правила');
            
            alert(`Правило применено к ${data.applied_count} товарам!`);
            fetchDiscounts();
            fetchRules();
            
        } catch (err: any) {
            alert(err.message);
        } finally {
            setApplyingRule(null);
        }
    };

    const handlePreviewRule = async (ruleId: number) => {
        try {
            const response = await fetch(API_URLS.DISCOUNTS.PREVIEW_RULE(ruleId), {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Ошибка предпросмотра');
            
            const data = await response.json();
            setPreviewData(data);
            setShowPreviewModal(true);
            
        } catch (err: any) {
            alert(`Ошибка предпросмотра: ${err.message}`);
        }
    };

    const handleToggleRule = async (ruleId: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        
        try {
            const response = await fetch(API_URLS.DISCOUNTS.TOGGLE_RULE(ruleId), {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ is_active: newStatus })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка изменения статуса правила');
            
            alert(`Правило ${newStatus ? 'включено' : 'выключено'}!`);
            fetchRules();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const toggleProductStatus = async (productId: number, isActive: boolean) => {
        const action = isActive ? 'deactivate' : 'activate';
        const confirmMessage = isActive 
            ? 'Вы уверены, что хотите снять товар с продажи?' 
            : 'Вы уверены, что хотите активировать товар?';
        
        if (!window.confirm(confirmMessage)) return;
        
        try {
            const response = await fetch(API_URLS.PRODUCTS.TOGGLE_STATUS(productId, action), {
                method: 'PATCH',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка изменения статуса');
            
            alert(data.message);
            fetchProducts();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const startEditProduct = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            category_id: categories.find(c => c.category_name === product.category)?.category_id.toString() || '',
            stock: product.stock.toString(),
            image_url: product.image_url || '',
            is_active: product.is_active
        });
    };

    const startEditRule = (rule: DiscountRule) => {
        setEditingRule(rule);
        
        let parsedCondition = {};
        if (rule.condition_value) {
            try {
                if (typeof rule.condition_value === 'string') {
                    parsedCondition = JSON.parse(rule.condition_value);
                } else {
                    parsedCondition = rule.condition_value;
                }
            } catch (err) {
                console.error('Error parsing condition_value:', err);
                parsedCondition = {};
            }
        }
        
        setRuleForm({
            rule_name: rule.rule_name,
            rule_type: rule.rule_type,
            condition_value: parsedCondition,
            discount_percent: rule.discount_percent.toString(),
            priority: rule.priority,
            end_date: rule.end_date ? rule.end_date.split('T')[0] : ''
        });
        setShowRuleForm(true);
    };

    const handleUpdateRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRule) return;
        
        try {
            const ruleId = String(editingRule.rule_id);
            
            let preparedConditionValue = ruleForm.condition_value;
            
            if (ruleForm.condition_value && typeof ruleForm.condition_value === 'object') {
                preparedConditionValue = JSON.stringify(ruleForm.condition_value);
            } else if (ruleForm.condition_value && typeof ruleForm.condition_value === 'string') {
                try {
                    JSON.parse(ruleForm.condition_value);
                    preparedConditionValue = ruleForm.condition_value;
                } catch {
                    preparedConditionValue = JSON.stringify({ value: ruleForm.condition_value });
                }
            }
            
            const updateData: any = {
                rule_name: ruleForm.rule_name,
                rule_type: ruleForm.rule_type,
                condition_value: preparedConditionValue,
                discount_percent: parseFloat(ruleForm.discount_percent) || 0,
                priority: parseInt(String(ruleForm.priority)) || 1,
            };
            
            if (ruleForm.end_date) {
                updateData.end_date = ruleForm.end_date;
            }
            
            const response = await fetch(API_URLS.DISCOUNTS.UPDATE_RULE(ruleId), {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка обновления правила');
            
            alert(data.message);
            setShowRuleForm(false);
            setEditingRule(null);
            setRuleForm({
                rule_name: '',
                rule_type: 'category',
                condition_value: {},
                discount_percent: '',
                priority: 1,
                end_date: ''
            });
            fetchRules();
            
        } catch (err: any) {
            alert(`Ошибка: ${err.message}`);
        }
    };

    const startSetDiscount = (product: Product) => {
        setSelectedProductForDiscount(product);
        setShowDiscountModal(true);
        setDiscountForm({
            discount_percent: '',
            end_date: ''
        });
    };

    const getRuleTypeLabel = (type: string): string => {
        const labels: {[key: string]: string} = {
            'category': 'По категории',
            'stock': 'По остаткам',
            'age': 'По времени на складе',
            'price_range': 'По цене',
            'seasonal': 'Сезонная',
            'new_arrivals': 'Новинки'
        };
        return labels[type] || type;
    };

    const updateCondition = (key: string, value: any) => {
        setRuleForm({
            ...ruleForm,
            condition_value: { ...ruleForm.condition_value, [key]: value }
        });
    };

    const clearFilters = () => {
        setSearchQuery('');
        setCategoryFilter('all');
        setStatusFilter('all');
        setStockFilter('all');
    };

    useEffect(() => {
        if (activeTab === 'products') {
            fetchProducts();
            fetchCategories();
        } else if (activeTab === 'categories') {
            fetchCategories();
        } else if (activeTab === 'discounts') {
            fetchDiscounts();
            fetchProducts();
        } else if (activeTab === 'rules') {
            fetchRules();
        }
    }, [activeTab]);

    if (loading && activeTab !== 'rules') return <div className="loading">Загрузка...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="merchandiser-page">
            <div className="page-header">
                <h1>Управление товарами</h1>
                
                <div className="header-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                        onClick={() => setActiveTab('products')}
                    >
                        🛍️ Товары
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
                        onClick={() => setActiveTab('categories')}
                    >
                        📁 Категории
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'discounts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('discounts')}
                    >
                        🏷️ Скидки
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rules')}
                    >
                        📋 Правила
                    </button>
                </div>
                
                {activeTab === 'products' && (
                    <button 
                        onClick={() => setShowAddForm(true)}
                        className="cta-button"
                    >
                        + Добавить товар
                    </button>
                )}
                
                {activeTab === 'categories' && (
                    <button 
                        onClick={() => {
                            setEditingCategory(null);
                            setCategoryFormData({ category_name: '', description: '' });
                            setShowCategoryForm(true);
                        }}
                        className="cta-button"
                    >
                        + Добавить категорию
                    </button>
                )}
                
                {activeTab === 'rules' && (
                    <button 
                        onClick={() => setShowRuleForm(true)}
                        className="cta-button"
                    >
                        + Создать правило
                    </button>
                )}
            </div>

            {activeTab === 'products' ? (
                <>
                    <div className="filters-panel">
                        <div className="search-box">
                            <input
                                type="text"
                                placeholder="🔍 Поиск по названию, описанию, категории..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        
                        <div className="filters-row">
                            <select 
                                value={categoryFilter} 
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">Все категории</option>
                                {categories.map(cat => (
                                    <option key={cat.category_id} value={cat.category_name}>
                                        {cat.category_name}
                                    </option>
                                ))}
                            </select>
                            
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">Все статусы</option>
                                <option value="active">Активные</option>
                                <option value="inactive">Снятые</option>
                            </select>
                            
                            <select 
                                value={stockFilter} 
                                onChange={(e) => setStockFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">Любой остаток</option>
                                <option value="in-stock">В наличии (&gt;0)</option>
                                <option value="out-of-stock">Нет в наличии</option>
                                <option value="low-stock">Мало (&lt;=5)</option>
                            </select>
                            
                            {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || stockFilter !== 'all') && (
                                <button onClick={clearFilters} className="clear-filters-btn">
                                    Сбросить фильтры
                                </button>
                            )}
                        </div>
                        
                        <div className="filter-info">
                            Найдено товаров: <strong>{filteredProducts.length}</strong> из {products.length}
                        </div>
                    </div>

                    <div className="products-table-container">
                        <table className="merchandiser-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Название</th>
                                    <th>Категория</th>
                                    <th>Цена</th>
                                    <th>Остаток</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(product => (
                                    <tr key={product.id}>
                                        <td>#{product.id}</td>
                                        <td>
                                            <div className="product-cell">
                                                {product.image_url && (
                                                    <img 
                                                        src={product.image_url} 
                                                        alt={product.name}
                                                        className="product-thumb"
                                                    />
                                                )}
                                                <div>
                                                    <strong>{product.name}</strong>
                                                    {product.description && (
                                                        <p className="product-description-small">
                                                            {product.description.length > 50 
                                                                ? product.description.substring(0, 50) + '...' 
                                                                : product.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{product.category}</td>
                                        <td>{product.price.toLocaleString()} ₽</td>
                                        <td>
                                            <span className={`stock-badge ${product.stock === 0 ? 'out' : product.stock <= 5 ? 'low' : 'normal'}`}>
                                                {product.stock} шт.
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                                                {product.is_active ? 'Активен' : 'Снят'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button 
                                                    onClick={() => startEditProduct(product)}
                                                    className="edit-btn"
                                                    title="Редактировать"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    onClick={() => toggleProductStatus(product.id, product.is_active)}
                                                    className={product.is_active ? 'deactivate-btn' : 'activate-btn'}
                                                    title={product.is_active ? 'Снять с продажи' : 'Активировать'}
                                                >
                                                    {product.is_active ? '⛔' : '✅'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {filteredProducts.length === 0 && (
                        <div className="empty-state">
                            <p>Товары не найдены</p>
                            {products.length > 0 ? (
                                <button onClick={clearFilters} className="secondary-btn">
                                    Сбросить фильтры
                                </button>
                            ) : (
                                <button onClick={() => setShowAddForm(true)} className="cta-button">
                                    Добавить первый товар
                                </button>
                            )}
                        </div>
                    )}
                </>

            ) : activeTab === 'categories' ? (
                <div className="categories-container">
                    <div className="section-header">
                        <h2>Управление категориями</h2>
                        <p>Создавайте и редактируйте категории товаров</p>
                    </div>

                    <div className="categories-grid">
                        {categories.map(category => (
                            <div key={category.category_id} className="category-card">
                                <div className="category-icon">📁</div>
                                <div className="category-info">
                                    <h3>{category.category_name}</h3>
                                    {category.description && (
                                        <p className="category-description">{category.description}</p>
                                    )}
                                    <div className="category-meta">
                                        <span className="category-products-count">
                                            Товаров: {
                                                products.filter(p => p.category === category.category_name).length
                                            }
                                        </span>
                                    </div>
                                </div>
                                <div className="category-actions">
                                    <button 
                                        onClick={() => startEditCategory(category)}
                                        className="edit-btn"
                                        title="Редактировать"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteCategory(category.category_id)}
                                        className="danger-btn"
                                        title="Удалить"
                                        disabled={products.some(p => p.category === category.category_name)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {categories.length === 0 && (
                        <div className="empty-state">
                            <p>Категории не созданы</p>
                            <button 
                                onClick={() => setShowCategoryForm(true)}
                                className="cta-button"
                            >
                                Создать первую категорию
                            </button>
                        </div>
                    )}
                </div>

            ) : activeTab === 'discounts' ? (
                <div className="discounts-container">
                    <div className="section-header">
                        <h2>Управление скидками</h2>
                        <p>Установите скидки на товары для привлечения клиентов</p>
                    </div>

                    <div className="discounts-table-container">
                        <table className="merchandiser-table">
                            <thead>
                                <tr>
                                    <th>Товар</th>
                                    <th>Категория</th>
                                    <th>Цена</th>
                                    <th>Скидка</th>
                                    <th>Финальная цена</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {discounts.map(discount => (
                                    <tr key={discount.discount_id}>
                                        <td>
                                            <div className="product-cell">
                                                {discount.image_url && (
                                                    <img 
                                                        src={discount.image_url} 
                                                        alt={discount.product_name}
                                                        className="product-thumb"
                                                    />
                                                )}
                                                <div>
                                                    <strong>{discount.product_name}</strong>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{discount.category_name}</td>
                                        <td>{discount.price.toLocaleString()} ₽</td>
                                        <td>
                                            <span className="discount-badge">
                                                -{discount.discount_percent}%
                                            </span>
                                        </td>
                                        <td>
                                            <strong className="final-price">
                                                {discount.final_price.toLocaleString()} ₽
                                            </strong>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${discount.status === 'Активная' ? 'active' : discount.status === 'Бессрочная' ? 'permanent' : 'expired'}`}>
                                                {discount.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => handleRemoveDiscount(discount.product_id)}
                                                className="remove-discount-btn"
                                                title="Удалить скидку"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {discounts.length === 0 && (
                        <div className="empty-state">
                            <p>Активные скидки не найдены</p>
                        </div>
                    )}

                    <div className="products-for-discount">
                        <h3>Товары без скидки</h3>
                        <div className="products-grid">
                            {products
                                .filter(product => !discounts.some(d => d.product_id === product.id))
                                .map(product => (
                                    <div key={product.id} className="product-card-small">
                                        <div className="product-card-content">
                                            {product.image_url && (
                                                <img 
                                                    src={product.image_url} 
                                                    alt={product.name}
                                                    className="product-thumb"
                                                />
                                            )}
                                            <div>
                                                <h4>{product.name}</h4>
                                                <p className="category">{product.category}</p>
                                                <p className="price">{product.price.toLocaleString()} ₽</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => startSetDiscount(product)}
                                            className="set-discount-btn"
                                        >
                                            Установить скидку
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rules-container">
                    <div className="section-header">
                        <h2>Управление правилами скидок</h2>
                        <p>Применяйте скидки автоматически по условиям</p>
                    </div>

                    <div className="rules-grid">
                        {rules.map(rule => (
                            <div key={rule.rule_id} className="rule-card">
                                <div className="rule-header">
                                    <h3>{rule.rule_name}</h3>
                                    <div className="header-status">
                                        <div className="status-chip">
                                            <span className={`status-dot ${rule.is_active ? 'active' : 'inactive'}`}></span>
                                            {rule.is_active ? 'Включено' : 'Выключено'}
                                        </div>
                                        <div className="status-chip">
                                            <span className={`status-dot ${rule.status === 'Активно' ? 'active' : rule.status === 'Бессрочное' ? 'permanent' : 'expired'}`}></span>
                                            {rule.status}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="rule-info">
                                    <div className="info-item">
                                        <span className="info-label">Тип:</span>
                                        <span className="info-value">{getRuleTypeLabel(rule.rule_type)}</span>
                                    </div>
                                    
                                    <div className="info-item">
                                        <span className="info-label">Скидка:</span>
                                        <span className="info-value discount-value">
                                            <strong>-{rule.discount_percent}%</strong>
                                        </span>
                                    </div>
                                    
                                    <div className="info-item">
                                        <span className="info-label">Приоритет:</span>
                                        <span className="info-value">
                                            <span className={`priority-tag priority-${rule.priority}`}>
                                                {rule.priority}
                                            </span>
                                        </span>
                                    </div>
                                    
                                    <div className="info-item">
                                        <span className="info-label">Применено:</span>
                                        <span className="info-value">{rule.applied_count || 0} раз</span>
                                    </div>
                                </div>
                                
                                <div className="rule-meta">
                                    {rule.last_applied && (
                                        <div className="meta-item">
                                            <span className="meta-icon">📅</span>
                                            Последнее: {new Date(rule.last_applied).toLocaleDateString()}
                                        </div>
                                    )}
                                    {rule.end_date && rule.status === 'Активно' && (
                                        <div className="meta-item">
                                            <span className="meta-icon">⏰</span>
                                            До: {new Date(rule.end_date).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="rule-actions">
                                    <button 
                                        onClick={() => handleApplyRule(rule.rule_id)}
                                        className="apply-btn"
                                        disabled={applyingRule === rule.rule_id || !rule.is_active}
                                        title={!rule.is_active ? 'Правило выключено' : 'Применить правило'}
                                    >
                                        {applyingRule === rule.rule_id ? '...' : 'Применить'}
                                    </button>
                                    
                                    <button 
                                        onClick={() => handlePreviewRule(rule.rule_id)}
                                        className="secondary-btn"
                                        title="Предпросмотр товаров"
                                    >
                                        👁️
                                    </button>
                                    
                                    <button 
                                        onClick={() => startEditRule(rule)}
                                        className="secondary-btn"
                                        title="Редактировать"
                                    >
                                        ✏️
                                    </button>
                                    
                                    <button 
                                        onClick={() => handleToggleRule(rule.rule_id, rule.is_active)}
                                        className="toggle-btn"
                                        title={rule.is_active ? 'Выключить правило' : 'Включить правило'}
                                    >
                                        {rule.is_active ? '⏸️' : '▶️'}
                                    </button>
                                    
                                    <button 
                                        onClick={() => handleRemoveRuleDiscounts(rule.rule_id)}
                                        className="danger-btn"
                                        title="Удалить скидки правила"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {rules.length === 0 && (
                        <div className="empty-state">
                            <p>Правила скидок не созданы</p>
                            <button 
                                onClick={() => setShowRuleForm(true)}
                                className="cta-button"
                            >
                                Создать первое правило
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Модальные окна (без изменений) */}
            {(showAddForm || editingProduct) && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>{editingProduct ? 'Редактирование товара' : 'Добавление товара'}</h2>
                        
                        <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}>
                            <div className="form-group">
                                <label>Название товара *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    placeholder="Худи МПТ Tech"
                                    required
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Описание</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleFormChange}
                                    placeholder="Описание товара"
                                    rows={3}
                                />
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Цена *</label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleFormChange}
                                        placeholder="2999"
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Количество на складе *</label>
                                    <input
                                        type="number"
                                        name="stock"
                                        value={formData.stock}
                                        onChange={handleFormChange}
                                        placeholder={editingProduct ? "Текущее количество" : "Начальное количество"}
                                        min="0"
                                        required
                                    />
                                    {editingProduct && (
                                        <small>Текущее количество: {editingProduct.stock} шт.</small>
                                    )}
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label>Категория *</label>
                                <select
                                    name="category_id"
                                    value={formData.category_id}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">Выберите категорию</option>
                                    {categories.map(category => (
                                        <option key={category.category_id} value={category.category_id}>
                                            {category.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label>Ссылка на изображение</label>
                                <input
                                    type="url"
                                    name="image_url"
                                    value={formData.image_url}
                                    onChange={handleFormChange}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                            
                            {editingProduct && (
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="is_active"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                is_active: e.target.checked
                                            })}
                                        />
                                        Активный товар
                                    </label>
                                </div>
                            )}
                            
                            <div className="modal-actions">
                                <button type="submit" className="cta-button">
                                    {editingProduct ? 'Сохранить изменения' : 'Добавить товар'}
                                </button>
                                <button 
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingProduct(null);
                                        setFormData({
                                            name: '',
                                            description: '',
                                            price: '',
                                            category_id: '',
                                            image_url: '',
                                            is_active: true,
                                            stock: '1'
                                        });
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCategoryForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>{editingCategory ? 'Редактирование категории' : 'Создание категории'}</h2>
                        
                        <form onSubmit={editingCategory ? handleUpdateCategory : handleAddCategory}>
                            <div className="form-group">
                                <label>Название категории *</label>
                                <input
                                    type="text"
                                    value={categoryFormData.category_name}
                                    onChange={(e) => setCategoryFormData({
                                        ...categoryFormData,
                                        category_name: e.target.value
                                    })}
                                    placeholder="Одежда"
                                    required
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Описание</label>
                                <textarea
                                    value={categoryFormData.description}
                                    onChange={(e) => setCategoryFormData({
                                        ...categoryFormData,
                                        description: e.target.value
                                    })}
                                    placeholder="Описание категории"
                                    rows={3}
                                />
                            </div>
                            
                            <div className="modal-actions">
                                <button type="submit" className="cta-button">
                                    {editingCategory ? 'Сохранить изменения' : 'Создать категорию'}
                                </button>
                                <button 
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => {
                                        setShowCategoryForm(false);
                                        setEditingCategory(null);
                                        setCategoryFormData({ category_name: '', description: '' });
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDiscountModal && selectedProductForDiscount && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Установить скидку</h2>
                        <p><strong>Товар:</strong> {selectedProductForDiscount.name}</p>
                        <p><strong>Текущая цена:</strong> {selectedProductForDiscount.price.toLocaleString()} ₽</p>
                        
                        <form onSubmit={handleSetDiscount}>
                            <div className="form-group">
                                <label>Процент скидки *</label>
                                <input
                                    type="number"
                                    value={discountForm.discount_percent}
                                    onChange={(e) => setDiscountForm({
                                        ...discountForm,
                                        discount_percent: e.target.value
                                    })}
                                    placeholder="10"
                                    min="0"
                                    max="100"
                                    required
                                />
                                <small>от 0 до 100%</small>
                            </div>
                            
                            <div className="form-group">
                                <label>Дата окончания (необязательно)</label>
                                <input
                                    type="datetime-local"
                                    value={discountForm.end_date}
                                    onChange={(e) => setDiscountForm({
                                        ...discountForm,
                                        end_date: e.target.value
                                    })}
                                />
                                <small>Оставьте пустым для бессрочной скидки</small>
                            </div>
                            
                            <div className="price-preview">
                                <p><strong>Итоговая цена:</strong> 
                                    {discountForm.discount_percent ? (
                                        <span className="final-price">
                                            {(
                                                selectedProductForDiscount.price * 
                                                (1 - parseFloat(discountForm.discount_percent) / 100)
                                            ).toLocaleString('ru-RU', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })} ₽
                                        </span>
                                    ) : (
                                        <span>{selectedProductForDiscount.price.toLocaleString()} ₽</span>
                                    )}
                                </p>
                            </div>
                            
                            <div className="modal-actions">
                                <button type="submit" className="cta-button">
                                    Установить скидку
                                </button>
                                <button 
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => {
                                        setShowDiscountModal(false);
                                        setSelectedProductForDiscount(null);
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRuleForm && (
                <div className="modal-overlay">
                    <div className="modal wide-modal">
                        <h2>{editingRule ? 'Редактирование правила' : 'Создание правила'}</h2>
                        
                        <form onSubmit={editingRule ? handleUpdateRule : handleCreateRule}>
                            <div className="form-group">
                                <label>Название правила *</label>
                                <input
                                    type="text"
                                    value={ruleForm.rule_name}
                                    onChange={(e) => setRuleForm({...ruleForm, rule_name: e.target.value})}
                                    placeholder="Сезонная распродажа одежды"
                                    required
                                />
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Тип правила *</label>
                                    <select
                                        value={ruleForm.rule_type}
                                        onChange={(e) => setRuleForm({
                                            ...ruleForm, 
                                            rule_type: e.target.value as any,
                                            condition_value: {}
                                        })}
                                        required
                                    >
                                        <option value="category">По категории</option>
                                        <option value="stock">По остаткам</option>
                                        <option value="age">По времени на складе</option>
                                        <option value="price_range">По ценовому диапазону</option>
                                        <option value="seasonal">Сезонная</option>
                                        <option value="new_arrivals">На новинки</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Скидка (%) *</label>
                                    <input
                                        type="number"
                                        value={ruleForm.discount_percent}
                                        onChange={(e) => setRuleForm({...ruleForm, discount_percent: e.target.value})}
                                        min="1"
                                        max="90"
                                        required
                                    />
                                </div>
                            </div>
                            
                            {ruleForm.rule_type === 'category' && (
                                <div className="form-group">
                                    <label>Категория</label>
                                    <select
                                        value={ruleForm.condition_value.category_id || ''}
                                        onChange={(e) => updateCondition('category_id', e.target.value)}
                                    >
                                        <option value="">Все категории</option>
                                        {categories.map(category => (
                                            <option key={category.category_id} value={category.category_id}>
                                                {category.category_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            {ruleForm.rule_type === 'stock' && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Мин. остаток</label>
                                        <input
                                            type="number"
                                            placeholder="10"
                                            min="0"
                                            onChange={(e) => updateCondition('min_stock', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Макс. остаток</label>
                                        <input
                                            type="number"
                                            placeholder="100"
                                            min="0"
                                            onChange={(e) => updateCondition('max_stock', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {ruleForm.rule_type === 'age' && (
                                <div className="form-group">
                                    <label>Товары на складе более (дней)</label>
                                    <input
                                        type="number"
                                        placeholder="30"
                                        min="1"
                                        onChange={(e) => updateCondition('min_days_in_stock', parseInt(e.target.value))}
                                    />
                                </div>
                            )}
                            
                            {ruleForm.rule_type === 'price_range' && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Мин. цена</label>
                                        <input
                                            type="number"
                                            placeholder="1000"
                                            min="0"
                                            step="0.01"
                                            onChange={(e) => updateCondition('min_price', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Макс. цена</label>
                                        <input
                                            type="number"
                                            placeholder="5000"
                                            min="0"
                                            step="0.01"
                                            onChange={(e) => updateCondition('max_price', parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {ruleForm.rule_type === 'seasonal' && (
                                <div className="form-group">
                                    <label>Сезон</label>
                                    <select
                                        onChange={(e) => updateCondition('season', e.target.value)}
                                    >
                                        <option value="">Любой сезон</option>
                                        <option value="winter">Зима</option>
                                        <option value="spring">Весна</option>
                                        <option value="summer">Лето</option>
                                        <option value="autumn">Осень</option>
                                    </select>
                                </div>
                            )}
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Приоритет (1-10)</label>
                                    <input
                                        type="number"
                                        value={ruleForm.priority}
                                        onChange={(e) => setRuleForm({...ruleForm, priority: parseInt(e.target.value)})}
                                        min="1"
                                        max="10"
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Действует до</label>
                                    <input
                                        type="date"
                                        value={ruleForm.end_date}
                                        onChange={(e) => setRuleForm({...ruleForm, end_date: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div className="modal-actions">
                                <button type="submit" className="cta-button">
                                    {editingRule ? 'Сохранить изменения' : 'Создать правило'}
                                </button>
                                <button 
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => {
                                        setShowRuleForm(false);
                                        setEditingRule(null);
                                        setRuleForm({
                                            rule_name: '',
                                            rule_type: 'category',
                                            condition_value: {},
                                            discount_percent: '',
                                            priority: 1,
                                            end_date: ''
                                        });
                                    }}
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPreviewModal && previewData && (
                <div className="modal-overlay">
                    <div className="modal wide-modal">
                        <div className="modal-header">
                            <h2>Предпросмотр правила: {previewData.rule.name}</h2>
                            <button 
                                className="modal-close-btn"
                                onClick={() => {
                                    setShowPreviewModal(false);
                                    setPreviewData(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="preview-summary">
                            <div className="summary-row">
                                <span>Скидка:</span>
                                <span className="discount-badge">-{previewData.rule.discount_percent}%</span>
                            </div>
                            <div className="summary-row">
                                <span>Тип правила:</span>
                                <span>{getRuleTypeLabel(previewData.rule.type)}</span>
                            </div>
                            <div className="summary-row">
                                <span>Затронет товаров:</span>
                                <span className="total-count">{previewData.total_count}</span>
                            </div>
                        </div>
                        
                        {previewData.products && previewData.products.length > 0 ? (
                            <>
                                <div className="preview-table-container">
                                    <table className="preview-table">
                                        <thead>
                                            <tr>
                                                <th>Товар</th>
                                                <th>Категория</th>
                                                <th>Текущая цена</th>
                                                <th>Новая цена</th>
                                                <th>Экономия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.products.map((product: any) => (
                                                <tr key={product.product_id}>
                                                    <td>{product.product_name}</td>
                                                    <td>{product.category_name}</td>
                                                    <td>{product.price.toLocaleString()} ₽</td>
                                                    <td className="new-price">
                                                        {product.new_price.toLocaleString()} ₽
                                                    </td>
                                                    <td className="savings">
                                                        -{product.price_change.toFixed(2)} ₽
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div className="modal-footer">
                                    <button 
                                        className="apply-preview-btn"
                                        onClick={() => {
                                            handleApplyRule(previewData.rule.rule_id || previewData.rule.id);
                                            setShowPreviewModal(false);
                                            setPreviewData(null);
                                        }}
                                    >
                                        Применить правило
                                    </button>
                                    <button 
                                        className="secondary-btn"
                                        onClick={() => {
                                            setShowPreviewModal(false);
                                            setPreviewData(null);
                                        }}
                                    >
                                        Закрыть
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="empty-preview">
                                <p>Нет товаров, соответствующих условиям правила</p>
                                <button 
                                    className="secondary-btn"
                                    onClick={() => setShowPreviewModal(false)}
                                >
                                    Закрыть
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManagement;