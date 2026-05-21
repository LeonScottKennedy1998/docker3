export interface AdminListUser {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    patronymic?: string;
    phone: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export interface RoleRow {
    id: number;
    name: string;
}

export interface AuditLogRow {
    id: number;
    action: string;
    table_name: string;
    table_id: number;
    old_data: unknown;
    new_data: unknown;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
    user_name: string;
    user_email: string;
}

export interface AuditStats {
    actions: Array<{
        action: string;
        count: string;
        first_occurrence: string;
        last_occurrence: string;
    }>;
    tables: Array<{
        table_name: string;
        count: string;
    }>;
    top_users: Array<{
        user_name: string;
        action_count: string;
    }>;
    total_logs: number;
}

export interface BackupFile {
    filename: string;
    size: string;
    created: string;
    type: 'SQL';
}

export interface BackupStats {
    totalBackups: number;
    totalSize: string;
    lastBackup: string | null;
}

export interface AdminDashboardStats {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    recentLogs: number;
}
