import React, { useState } from 'react';
import ProductManagement from './ProductManagement';
import OrderManagement from './OrderManagement';
import './Merchandiser.css';
import AnalyticsDashboard from '../analyst/AnalystDashboard';

interface MerchandiserDashboardProps {
    defaultTab?: 'products' | 'orders' | 'analytics';
}

const MerchandiserDashboard: React.FC<MerchandiserDashboardProps> = ({ defaultTab = 'orders' }) => {
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics'>(defaultTab);

    return (
        <div className="merchandiser-dashboard">
            <div className="dashboard-header">
                <h1>Панель товароведа</h1>
                <p>Управление товарами, заказами и аналитикой магазина мерча</p>
            </div>

            <div className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    📦 Управление заказами
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    🛍️ Управление товарами
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    📊 Аналитика и отчеты
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'products' && <ProductManagement />}
                {activeTab === 'orders' && <OrderManagement />}
                {activeTab === 'analytics' && <AnalyticsDashboard />}
            </div>

            <div className="dashboard-info">
                <div className="info-card">
                    <h4>📋 Инструкция</h4>
                    <ul>
                        <li>Для изменения статуса заказа выберите заказ и используйте выпадающий список</li>
                        <li>Чтобы снять товар с продажи, нажмите кнопку "Снять" в таблице товаров</li>
                        <li>При подтверждении заказа товары автоматически резервируются</li>
                    </ul>
                </div>
                
                <div className="info-card">
                    <h4>📞 Контакты</h4>
                    <p>При возникновении вопросов обращайтесь к администратору системы.</p>
                    <p>Email: admin@mpt.ru</p>
                </div>
            </div>
        </div>
    );
};

export default MerchandiserDashboard;