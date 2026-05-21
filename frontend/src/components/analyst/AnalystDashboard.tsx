import React, { useState, useEffect } from 'react';
import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';
import ReportGenerator from './ReportGenerator';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { AnalystDashboardStats } from '../../types/analyst';

const AnalyticsDashboard = () => {
    const [stats, setStats] = useState<AnalystDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard');

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        
        try {
            const response = await fetch(API_URLS.ANALYTICS.DASHBOARD_STATS, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Ошибка загрузки статистики');
            
            const data = await response.json();
            setStats(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Загрузка аналитики...</div>;
    if (error) return <div className="error-message">{error}</div>;
    if (!stats) return <div>Нет данных</div>;

    const chartData = stats.popularProducts.slice(0, 8).map(product => ({
        name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
        fullName: product.name,
        quantity: product.total_quantity,
        revenue: product.revenue,
        orders: product.orders_count
    }));

    return (
        <div className="analytics-dashboard">
            <div className="dashboard-header">
                <h1>📊 Аналитика и отчеты</h1>
                <p>Статистика магазина мерча</p>
            </div>

            <div className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    📈 Общая статистика
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reports')}
                >
                    📄 Генерация отчетов
                </button>
            </div>

            {activeTab === 'dashboard' ? (
                <div className="dashboard-content">
                    <div className="stats-cards">
                        <div className="stat-card">
                            <div className="stat-icon">👥</div>
                            <div className="stat-info">
                                <h3>Пользователи</h3>
                                <div className="stat-number">{stats.totalUsers}</div>
                                <div className="stat-label">Клиентов</div>
                            </div>
                        </div>
                        
                        <div className="stat-card">
                            <div className="stat-icon">🛍️</div>
                            <div className="stat-info">
                                <h3>Товары</h3>
                                <div className="stat-number">{stats.totalProducts}</div>
                                <div className="stat-label">В продаже</div>
                            </div>
                        </div>
                        
                        <div className="stat-card">
                            <div className="stat-icon">📦</div>
                            <div className="stat-info">
                                <h3>Заказы</h3>
                                <div className="stat-number">{stats.totalOrders}</div>
                                <div className="stat-label">Всего заказов</div>
                            </div>
                        </div>
                        
                        <div className="stat-card">
                            <div className="stat-icon">💰</div>
                            <div className="stat-info">
                                <h3>Выручка</h3>
                                <div className="stat-number">{stats.totalRevenue.toLocaleString()} ₽</div>
                                <div className="stat-label">Общая выручка</div>
                            </div>
                        </div>
                    </div>

                    <div className="chart-card">
                        <h3>🏆 Популярные товары</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis 
                                        dataKey="name" 
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis yAxisId="left" />
                                    <YAxis 
                                        yAxisId="right" 
                                        orientation="right"
                                        tickFormatter={(value) => `${value.toLocaleString()} ₽`}
                                    />
                                    <Tooltip 
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const dataItem = chartData.find(item => item.name === label);
                                                return (
                                                    <div className="custom-tooltip">
                                                        <p className="tooltip-title">{dataItem?.fullName || label}</p>
                                                        <p style={{ color: '#8884d8' }}>
                                                            Количество: <strong>{payload[0]?.value} шт.</strong>
                                                        </p>
                                                        <p style={{ color: '#82ca9d' }}>
                                                            Выручка: <strong>{Number(payload[1]?.value).toLocaleString()} ₽</strong>
                                                        </p>
                                                        <p style={{ color: '#ff8042' }}>
                                                            Заказов: <strong>{dataItem?.orders}</strong>
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Bar 
                                        yAxisId="left"
                                        dataKey="quantity" 
                                        name="Количество (шт.)" 
                                        fill="#8884d8" 
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar 
                                        yAxisId="right"
                                        dataKey="revenue" 
                                        name="Выручка (руб.)" 
                                        fill="#82ca9d" 
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="table-card">
                        <h3>📋 Детальная статистика по товарам</h3>
                        <div className="table-container">
                            <table className="analytics-table">
                                <thead>
                                    <tr>
                                        <th>Товар</th>
                                        <th>Заказов</th>
                                        <th>Продано шт.</th>
                                        <th>Выручка</th>
                                        <th>Средняя цена за шт.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.popularProducts.map((product, index) => (
                                        <tr key={index}>
                                            <td>{product.name}</td>
                                            <td>{product.orders_count}</td>
                                            <td>{product.total_quantity}</td>
                                            <td>{product.revenue.toLocaleString()} ₽</td>
                                            <td>{(product.revenue / product.total_quantity).toLocaleString(undefined, { minimumFractionDigits: 0 })} ₽</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <ReportGenerator />
            )}
        </div>
    );
};

export default AnalyticsDashboard;