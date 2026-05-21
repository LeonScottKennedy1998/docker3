import React, { useState, useEffect, useMemo } from 'react';
import './Admin.css';
import '../auth/Auth.css';
import { API_URLS, getAuthHeaders } from '../../config/api';
import type { AdminListUser, RoleRow } from '../../types/admin';

const UserManagement = () => {
    const [users, setUsers] = useState<AdminListUser[]>([]);
    const [roleList, setRoleList] = useState<RoleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminListUser | null>(null);
    const [selectedUser, setSelectedUser] = useState<AdminListUser | null>(null);
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        patronymic: '',
        phone: '',
        role: 'Клиент',
        is_active: true
    });

    const [passwordResetData, setPasswordResetData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [showResetNew, setShowResetNew] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const defaultRoleName = useMemo(() => {
        const names = roleList.map(r => r.name);
        if (names.includes('Клиент')) return 'Клиент';
        return names[0] || 'Клиент';
    }, [roleList]);

    const fetchRoles = async () => {
        try {
            const response = await fetch(API_URLS.USERS.ROLES, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('Ошибка загрузки ролей');
            const data: RoleRow[] = await response.json();
            setRoleList(data);
        } catch {
            setRoleList([
                { id: 1, name: 'Администратор' },
                { id: 2, name: 'Товаровед' },
                { id: 3, name: 'Аналитик' },
                { id: 4, name: 'Клиент' },
                { id: 5, name: 'Менеджер по закупкам' }
            ]);
        }
    };

    const fetchUsers = async () => {
        
        try {
            const response = await fetch(API_URLS.USERS.BASE, {
                headers: getAuthHeaders()

            });
            
            if (!response.ok) throw new Error('Ошибка загрузки пользователей');
            
            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
        fetchUsers();
    }, []);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePasswordResetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordResetData({
            ...passwordResetData,
            [e.target.name]: e.target.value
        });
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const response = await fetch(API_URLS.USERS.BASE, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка создания пользователя');
            
            alert('Пользователь успешно создан!');
            setShowAddForm(false);
            setFormData({
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                patronymic: '',
                phone: '',
                role: defaultRoleName,
                is_active: true
            });
            fetchUsers();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        
        
        try {
            const response = await fetch(API_URLS.USERS.BY_ID(editingUser.id), {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    role: formData.role,
                    is_active: formData.is_active
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка обновления пользователя');
            
            alert('Пользователь успешно обновлен!');
            setEditingUser(null);
            setFormData({
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                patronymic: '',
                phone: '',
                role: defaultRoleName,
                is_active: true
            });
            fetchUsers();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const toggleUserStatus = async (userId: number, isActive: boolean) => {
        const action = isActive ? 'block' : 'unblock';
        const confirmMessage = isActive 
            ? 'Вы уверены, что хотите заблокировать пользователя?' 
            : 'Вы уверены, что хотите разблокировать пользователя?';
        
        if (!window.confirm(confirmMessage)) return;
        
        try {
            const response = await fetch(API_URLS.USERS.TOGGLE_BLOCK(userId, action), {
                method: 'PATCH',
                headers: getAuthHeaders()
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка изменения статуса');
            
            alert(data.message);
            fetchUsers();
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handlePasswordReset = async () => {
        if (!selectedUser) return;
        
        if (passwordResetData.newPassword !== passwordResetData.confirmPassword) {
            alert('Пароли не совпадают');
            return;
        }
        
        if (passwordResetData.newPassword.length < 6) {
            alert('Пароль должен содержать минимум 6 символов');
            return;
        }
        
        
        try {
            const response = await fetch(API_URLS.USERS.RESET_PASSWORD(selectedUser.id), {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    newPassword: passwordResetData.newPassword
                })
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка сброса пароля');
            
            alert('Пароль успешно сброшен!');
            setPasswordResetData({
                newPassword: '',
                confirmPassword: ''
            });
            
        } catch (err: any) {
            alert(err.message);
        }
    };

    const startEditUser = (user: AdminListUser) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '',
            first_name: user.first_name,
            last_name: user.last_name,
            patronymic: user.patronymic || '',
            phone: user.phone,
            role: user.role,
            is_active: user.is_active
        });
    };

    if (loading) return <div className="loading">Загрузка пользователей...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Управление пользователями</h1>
                <button 
                    onClick={() => setShowAddForm(true)}
                    className="cta-button"
                >
                    + Добавить пользователя
                </button>
            </div>

            {(showAddForm || editingUser) && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>{editingUser ? 'Роль и доступ пользователя' : 'Добавление пользователя'}</h2>

                        {editingUser && (
                            <div className="admin-user-readonly">
                                <p>
                                    <strong>ФИО:</strong> {editingUser.last_name} {editingUser.first_name}{' '}
                                    {editingUser.patronymic || ''}
                                </p>
                                <p>
                                    <strong>Email:</strong> {editingUser.email}
                                </p>
                                <p>
                                    <strong>Телефон:</strong> {editingUser.phone}
                                </p>
                                <p className="hint-text">
                                    Персональные данные пользователь изменяет сам в профиле. Здесь доступны
                                    только роль и блокировка аккаунта.
                                </p>
                            </div>
                        )}

                        <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
                            {!editingUser && (
                                <>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Имя *</label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleFormChange}
                                        placeholder="Иван"
                                        required
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Фамилия *</label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleFormChange}
                                        placeholder="Иванов"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label>Отчество</label>
                                <input
                                    type="text"
                                    name="patronymic"
                                    value={formData.patronymic}
                                    onChange={handleFormChange}
                                    placeholder="Иванович"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleFormChange}
                                    placeholder="user@mpt.ru"
                                    required
                                />
                            </div>
                            
                                <div className="form-group password-group">
                                    <label>Пароль *</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showCreatePassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleFormChange}
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowCreatePassword((v) => !v)}
                                            aria-label={showCreatePassword ? 'Скрыть пароль' : 'Показать пароль'}
                                        >
                                            {showCreatePassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Телефон *</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleFormChange}
                                        placeholder="+7 (999) 123-45-67"
                                        required
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Роль *</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleFormChange}
                                        required
                                    >
                                        {roleList.map(r => (
                                            <option key={r.id} value={r.name}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                                </>
                            )}

                            {editingUser && (
                                <div className="form-group">
                                    <label>Роль *</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleFormChange}
                                        required
                                    >
                                        {roleList.map(r => (
                                            <option key={r.id} value={r.name}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            <div className="checkbox-field">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) =>
                                        setFormData({ ...formData, is_active: e.target.checked })
                                    }
                                />
                                <label htmlFor="is_active">Активный аккаунт</label>
                            </div>
                            
                            <div className="modal-actions">
                                <button type="submit" className="cta-button">
                                    {editingUser ? 'Сохранить изменения' : 'Добавить пользователя'}
                                </button>
                                <button 
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingUser(null);
                                        setFormData({
                                            email: '',
                                            password: '',
                                            first_name: '',
                                            last_name: '',
                                            patronymic: '',
                                            phone: '',
                                            role: defaultRoleName,
                                            is_active: true
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

            {selectedUser && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Сброс пароля для {selectedUser.email}</h2>
                        
                        <div className="form-group password-group">
                            <label>Новый пароль *</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showResetNew ? 'text' : 'password'}
                                    name="newPassword"
                                    value={passwordResetData.newPassword}
                                    onChange={handlePasswordResetChange}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowResetNew((v) => !v)}
                                    aria-label={showResetNew ? 'Скрыть пароль' : 'Показать пароль'}
                                >
                                    {showResetNew ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        </div>

                        <div className="form-group password-group">
                            <label>Подтвердите пароль *</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showResetConfirm ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={passwordResetData.confirmPassword}
                                    onChange={handlePasswordResetChange}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowResetConfirm((v) => !v)}
                                    aria-label={showResetConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                                >
                                    {showResetConfirm ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="modal-actions">
                            <button 
                                onClick={handlePasswordReset}
                                className="cta-button"
                                disabled={!passwordResetData.newPassword || !passwordResetData.confirmPassword}
                            >
                                Сбросить пароль
                            </button>
                            <button 
                                type="button"
                                className="secondary-btn"
                                onClick={() => {
                                    setSelectedUser(null);
                                    setPasswordResetData({
                                        newPassword: '',
                                        confirmPassword: ''
                                    });
                                }}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="users-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>ФИО</th>
                            <th>Email</th>
                            <th>Телефон</th>
                            <th>Роль</th>
                            <th>Статус</th>
                            <th>Дата регистрации</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>#{user.id}</td>
                                <td>
                                    {user.last_name} {user.first_name} {user.patronymic || ''}
                                </td>
                                <td>{user.email}</td>
                                <td>{user.phone}</td>
                                <td>
                                    <span className={`role-badge ${user.role.toLowerCase()}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                        {user.is_active ? 'Активен' : 'Заблокирован'}
                                    </span>
                                </td>
                                <td>
                                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        <button 
                                            onClick={() => startEditUser(user)}
                                            className="edit-btn"
                                        >
                                            Редактировать
                                        </button>
                                        <button 
                                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                                            className={user.is_active ? 'block-btn' : 'unblock-btn'}
                                        >
                                            {user.is_active ? 'Блокировать' : 'Разблокировать'}
                                        </button>
                                        <button 
                                            onClick={() => setSelectedUser(user)}
                                            className="reset-btn"
                                        >
                                            Сброс пароля
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {users.length === 0 && (
                <div className="empty-state">
                    <p>Пользователи не найдены</p>
                </div>
            )}
            
            <div className="info-card">
                <h4>📋 Информация</h4>
                <ul>
                    <li>Пароли пользователей хранятся в зашифрованном виде</li>
                    <li>ФИО пользователей шифруются в базе данных</li>
                    <li>Список ролей подгружается из базы данных</li>
                    <li>При редактировании администратор меняет только роль и активность аккаунта; личные данные пользователь правит в профиле</li>
                    <li>Все действия администратора записываются в журнал аудита</li>
                    <li>Администратор не может заблокировать самого себя</li>
                </ul>
            </div>
        </div>
    );
};

export default UserManagement;