import React, { useState, useEffect } from 'react';
import UserManagement from './UserManagement';
import AuditLog from './AuditLog';
import './Admin.css';
import BackupManagement from './BackupManagement';
import PerformanceDashboard from './PerformanceDashboard';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { AdminDashboardStats } from '../../types/admin';
import type { AdminDashboardProps } from '../../types/props';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = 'users' }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'backup' | 'performance'>('users');
    const [stats, setStats] = useState<AdminDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        
        try {
            const usersResponse = await fetch(API_URLS.USERS.BASE, {
                headers: getAuthHeaders()
            });
            const users = await usersResponse.json();
            
            const logsResponse = await fetch(`${API_URLS.AUDIT.BASE}?limit=5`, {
                headers: getAuthHeaders()
            });
            const logs = await logsResponse.json();
            
            const totalUsers = users.length;
            const activeUsers = users.filter((u: any) => u.is_active).length;
            const blockedUsers = users.filter((u: any) => !u.is_active).length;
            
            setStats({
                totalUsers,
                activeUsers,
                blockedUsers,
                recentLogs: logs.pagination?.total || 0
            });
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>Панель администратора</h1>
                <p>Управление пользователями и мониторинг системы</p>
            </div>

            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>Всего пользователей</h3>
                        <div className="stat-number">{stats.totalUsers}</div>
                        <div className="stat-detail">
                            Активных: {stats.activeUsers} | Заблокированных: {stats.blockedUsers}
                        </div>
                    </div>
                    
                    <div className="stat-card">
                        <h3>Записей в журнале</h3>
                        <div className="stat-number">{stats.recentLogs.toLocaleString()}</div>
                        <div className="stat-detail">Всего за все время</div>
                    </div>

                    
                    
                </div>
            )}

            <div className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Управление пользователями
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    📋 Журнал аудита
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('backup')}
                >
                    💾 Резервные копии
                </button>

                <button 
                    className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance')}
                >
                    📊 Производительность
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'users' ? <UserManagement /> : 
                activeTab === 'audit' ? <AuditLog /> : 
                activeTab === 'backup' ? <BackupManagement /> : 
                activeTab === 'performance' ? <PerformanceDashboard /> :null}
            </div>

            
        </div>
    );
};

export default AdminDashboard;