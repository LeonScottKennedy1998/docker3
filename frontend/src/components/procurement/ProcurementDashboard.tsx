import React, { useState, useEffect } from 'react';
import './ProcurementDashboard.css';
import SupplierManagement from './SupplierManagement';
import OrderManagement from './OrderManagement';
import StockAnalysis from './StockAnalysis';
import type { ProcurementDashboardProps } from '../../types/props';

const ProcurementDashboard: React.FC<ProcurementDashboardProps> = ({ defaultTab = 'orders' }) => {
    const [activeTab, setActiveTab] = useState<'suppliers' | 'orders' | 'stock'>(defaultTab); 

    return (
        <div className="procurement-dashboard">
            <div className="dashboard-header">
                <h1>Панель менеджера по закупкам</h1>
                <p>Управление поставщиками, заявками и анализ склада</p>
            </div>

            <div className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    📦 Управление заявками
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suppliers')}
                >
                    👥 Управление поставщиками
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stock')}
                >
                    📊 Анализ склада
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'suppliers' && <SupplierManagement />}
                {activeTab === 'orders' && <OrderManagement />} 
                {activeTab === 'stock' && <StockAnalysis />}
            </div>

            <div className="dashboard-info">
                <div className="info-card">
                    <h4>📋 Быстрые действия</h4>
                    <ul>
                        <li>Нажмите "🚚 Заказать" в анализе склада для быстрой закупки</li>
                        <li>Используйте фильтры для сортировки по приоритету</li>
                        <li>Критические товары подсвечены красным - заказывайте их в первую очередь</li>
                    </ul>
                </div>
                
                <div className="info-card">
                    <h4>📞 Контакты</h4>
                    <p>При возникновении вопросов обращайтесь к администратору системы.</p>
                    <p>Email: admin@mpt.ru</p>
                    <p>Телефон: +7 (495) 123-45-67</p>
                </div>
            </div>
        </div>
    );
};

export default ProcurementDashboard;