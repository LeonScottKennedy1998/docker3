import React, { useState } from 'react';
import './Analytics.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { ReportSummary, StatusStat } from '../../types/analyst';

const ReportGenerator = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [format, setFormat] = useState<'json' | 'csv'>('json');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [statusStats, setStatusStats] = useState<StatusStat[]>([]);

    const formatDateForDB = (dateString: string) => {
        if (!dateString) return null;
        return dateString;
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            alert('Укажите период для отчета');
            return;
        }

        const formattedStartDate = `${startDate} 00:00:00`;
        const formattedEndDate = `${endDate} 23:59:59`;

        console.log('Отправка запроса с датами:', {
            startDate: formattedStartDate,
            endDate: formattedEndDate
        });

        setLoading(true);

        try {
            const response = await fetch(API_URLS.ANALYTICS.GENERATE_REPORT, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    startDate: formattedStartDate,
                    endDate: formattedEndDate,
                    format
                })
            });

            console.log('Ответ сервера:', response.status);

            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            if (format === 'csv') {
                const blob = await response.blob();
                
                if (blob.size === 0) {
                    alert('Нет данных для выбранного периода');
                    setLoading(false);
                    return;
                }
                
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sales_report_${startDate}_to_${endDate}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                const data = await response.json();
                console.log('Полученные данные:', data);
                
                if (!data.orders || data.orders.length === 0) {
                    alert('Нет данных для выбранного периода');
                    setReportData(null);
                    setSummary(null);
                    setStatusStats([]);
                } else {
                    setReportData(data.orders);
                    setSummary(data.summary);
                    setStatusStats(data.statusStats || []);
                }
            }
        } catch (error) {
            console.error('Ошибка генерации отчета:', error);
            alert('Ошибка генерации отчета. Проверьте консоль для деталей.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const testLast7Days = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        
        const formatDateForInput = (date: Date) => {
            return date.toISOString().split('T')[0];
        };
        
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));
        
        setTimeout(() => {
            const generateBtn = document.querySelector('.generate-btn') as HTMLButtonElement;
            if (generateBtn && !generateBtn.disabled) {
                generateBtn.click();
            }
        }, 500);
    };

    const testCurrentMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const formatDateForInput = (date: Date) => {
            return date.toISOString().split('T')[0];
        };
        
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));
        
        setTimeout(() => {
            const generateBtn = document.querySelector('.generate-btn') as HTMLButtonElement;
            if (generateBtn && !generateBtn.disabled) {
                generateBtn.click();
            }
        }, 500);
    };

    return (
        <div className="report-generator">
            <div className="report-controls">
                <h3>⚙️ Настройки отчета</h3>
                
                
                <div className="date-controls">
                    <div className="form-group">
                        <label>Начальная дата *</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            max={endDate || undefined}
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Конечная дата *</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate || undefined}
                            required
                        />
                    </div>
                </div>
                
                <div className="format-controls">
                    <div className="form-group">
                        <label>Формат отчета</label>
                        <div className="format-buttons">
                            <button
                                className={`format-btn ${format === 'json' ? 'active' : ''}`}
                                onClick={() => setFormat('json')}
                            >
                                JSON (Просмотр)
                            </button>
                            <button
                                className={`format-btn ${format === 'csv' ? 'active' : ''}`}
                                onClick={() => setFormat('csv')}
                            >
                                CSV (Скачать)
                            </button>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={handleGenerateReport}
                    className="generate-btn"
                    disabled={loading || !startDate || !endDate}
                >
                    {loading ? 'Генерация...' : format === 'csv' ? '📥 Скачать отчет' : '📊 Сгенерировать отчет'}
                </button>
                
                {startDate && endDate && (
                    <div className="selected-period">
                        <strong>Выбранный период:</strong> {formatDate(startDate)} - {formatDate(endDate)}
                        <br />
                    </div>
                )}
            </div>

            {summary && (
                <div className="report-summary">
                    <h3>📋 Итоги за период</h3>
                    
                    <div className="summary-cards">
                        <div className="summary-card">
                            <div className="summary-icon">📦</div>
                            <div className="summary-content">
                                <div className="summary-number">{summary.totalOrders}</div>
                                <div className="summary-label">Всего заказов</div>
                            </div>
                        </div>
                        
                        <div className="summary-card">
                            <div className="summary-icon">💰</div>
                            <div className="summary-content">
                                <div className="summary-number">{summary.totalRevenue.toLocaleString()} ₽</div>
                                <div className="summary-label">Общая выручка</div>
                            </div>
                        </div>
                        
                        <div className="summary-card">
                            <div className="summary-icon">📊</div>
                            <div className="summary-content">
                                <div className="summary-number">{summary.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 0 })} ₽</div>
                                <div className="summary-label">Средний чек</div>
                            </div>
                        </div>
                        
                        <div className="summary-card">
                            <div className="summary-icon">👥</div>
                            <div className="summary-content">
                                <div className="summary-number">{summary.uniqueCustomers}</div>
                                <div className="summary-label">Уникальных клиентов</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {statusStats && statusStats.length > 0 && (
                <div className="status-stats">
                    <h3>📊 Распределение по статусам</h3>
                    
                    <div className="stats-table-container">
                        <table className="stats-table">
                            <thead>
                                <tr>
                                    <th>Статус</th>
                                    <th>Количество</th>
                                    <th>Выручка</th>
                                    <th>Доля</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statusStats.map((stat, index) => {
                                    
                                    return (
                                        <tr key={index}>
                                            <td>
                                                <div className="status-row">
                                                    <span className="status-dot" style={{ 
                                                        backgroundColor: stat.status === 'Подтвержден' ? '#2ecc71' : 
                                                                      stat.status === 'В обработке' ? '#f39c12' : '#e74c3c'
                                                    }}></span>
                                                    {stat.status}
                                                </div>
                                            </td>
                                            <td>{stat.count}</td>
                                            <td>{stat.revenue ? stat.revenue.toLocaleString() + ' ₽' : '-'}</td>
                                            <td>
                                                <div className="percentage-bar">
                                                    <div
                                                    className="percentage-fill"
                                                    style={{ width: `${stat.percentage}%` }}
                                                    />
                                                    <span className="percentage-text">
                                                    {stat.percentage}%
                                                    </span>
                                                </div>
                                                </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {reportData && reportData.length > 0 && format === 'json' && (
                <div className="report-details">
                    <h3>📋 Детали заказов ({reportData.length})</h3>
                    
                    <div className="report-table-container">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>ID заказа</th>
                                    <th>Клиент</th>
                                    <th>Статус</th>
                                    <th>Телефон</th>
                                    <th>Дата</th>
                                    <th>Сумма</th>
                                    <th>Товаров</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.slice(0, 20).map((order: any) => (
                                    <tr key={order.order_id}>
                                        <td>#{order.order_id}</td>
                                        <td>{order.customer_name}</td>
                                        <td>
                                            <span className={`status-badge ${order.status === 'Подтвержден' ? 'confirmed' : 
                                                                    order.status === 'В обработке' ? 'processing' : 'cancelled'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td>{order.phone}</td>
                                        <td>{new Date(order.created_at).toLocaleDateString('ru-RU')}</td>
                                        <td>{order.total.toLocaleString()} ₽</td>
                                        <td>{order.items?.length || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {reportData.length > 20 && (
                            <div className="report-note">
                                Показано 20 из {reportData.length} заказов. Полный отчет доступен для скачивания в формате CSV.
                            </div>
                        )}
                    </div>
                    
                    <div className="report-actions">
                        <button 
                            className="secondary-btn"
                            onClick={() => {
                                const dataStr = JSON.stringify(reportData, null, 2);
                                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                                const a = document.createElement('a');
                                a.href = dataUri;
                                a.download = `report_${startDate}_to_${endDate}.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            }}
                        >
                            💾 Скачать JSON
                        </button>
                    </div>
                </div>
            )}

            {reportData && reportData.length === 0 && (
                <div className="empty-report">
                    <div className="empty-icon">📭</div>
                    <h3>Нет данных за выбранный период</h3>
                    <p>Попробуйте выбрать другой период или проверьте наличие заказов в базе данных.</p>
                    <button 
                        onClick={testLast7Days}
                        className="test-btn"
                    >
                        Попробовать последние 7 дней
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReportGenerator;