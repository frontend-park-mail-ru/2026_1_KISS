// Server response envelope: every endpoint wraps its payload as { data, error }.
export interface ApiEnvelope<T> {
    data: T;
    error?: string;
}

// ===== User / Auth =====

export interface UserDTO {
    id: number;
    username: string;
    email: string;
    avatar_url: string;
    status: string;
    description: string;
    is_verified: boolean;
    is_admin: boolean;
    plan: string;
    total_time_seconds: number;
    last_active_at?: string;
    created_at: string;
    updated_at: string;
}

// ===== Notebook =====

export interface BlockOutputDTO {
    output_type: string;
    content: string;
    position: number;
}

export interface BlockDTO {
    id: number;
    type: string;
    language: string;
    content: string;
    position: number;
    outputs?: BlockOutputDTO[];
    created_at: string;
    execution_count?: number;
}

export interface NotebookDTO {
    id: number;
    owner_id: number;
    owner_username?: string;
    title: string;
    is_public: boolean;
    blocks?: BlockDTO[];
    created_at: string;
    updated_at: string;
}

export interface NotebookListResponse {
    notebooks: NotebookDTO[];
    total: number;
    limit: number;
    offset: number;
}

// ===== Permissions =====

export interface PermissionDTO {
    notebook_id: number;
    user_id: number;
    permission_level: string;
    email?: string;
}

export interface PermissionListResponse {
    permissions: PermissionDTO[];
}

// ===== Comments =====

export interface CommentDTO {
    id: number;
    user_id: number;
    username: string;
    block_id: number;
    text: string;
    created_at: string;
}

// ===== Issues =====

export interface IssueMessageDTO {
    id: number;
    issue_id: number;
    user_id: number;
    username?: string;
    is_admin: boolean;
    content: string;
    created_at: string;
}

export interface IssueDTO {
    id: number;
    user_id: number;
    username?: string;
    category: string;
    status: string;
    content: string;
    messages: IssueMessageDTO[];
    attachments?: IssueAttachmentDTO[];
    created_at: string;
    updated_at: string;
}

export interface IssueAttachmentDTO {
    id: number;
    filename: string;
    mime_type: string;
    size: number;
}

export interface IssueListResponse {
    issues: IssueDTO[];
    total: number;
    limit: number;
    offset: number;
}

export interface IssueStatsResponse {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
    by_category: Record<string, number>;
}

// ===== Runner =====

export interface OutputItemDTO {
    mime_type: string;
    data: string;
}

export interface ExecutionResultDTO {
    block_id: number;
    position: number;
    stdout: string[];
    stderr: string[];
    result: string;
    outputs: OutputItemDTO[];
    error: string;
    executed_at: string;
    duration: string;
}

export interface ContainerStatsDTO {
    cpu_percent: number;
    memory_usage: number;
    memory_limit: number;
    memory_percent: number;
    cpu_cores: number;
    disk_limit_bytes: number;
    gpu_available: boolean;
}

// ===== Admin =====

export interface AdminUserListResponse {
    users: UserDTO[];
    total: number;
}

export interface AdminNotebookSummaryDTO {
    id: number;
    owner_id: number;
    title: string;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

export interface AdminNotebookListResponse {
    notebooks: AdminNotebookSummaryDTO[];
    total: number;
}

export interface AdminStatsResponse {
    total_users: number;
    total_sessions: number;
    dau: number;
    mau: number;
    total_notebooks: number;
}

export interface AdminActivityPoint {
    date: string;
    count: number;
}

export interface AdminMonthlyPoint {
    month: string;
    count: number;
}

export interface AdminActivityStatsResponse {
    dau: AdminActivityPoint[];
    mau: AdminMonthlyPoint[];
}

// ===== WebSocket events =====

export type NotebookEventType =
    | 'block_added'
    | 'block_updated'
    | 'block_deleted'
    | 'notebook_updated'
    | 'comment_added'
    | 'comment_deleted';

export interface NotebookEventDTO {
    type: NotebookEventType | string;
    notebook_id?: number;
    actor_id?: number;
    block?: BlockDTO;
    block_id?: number | string;
    deleted_block_id?: number;
    comment?: CommentDTO;
    comment_id?: number | string;
    deleted_comment_id?: number;
    timestamp?: number;
    message?: string;
}

// ===== Streaming (websocket runtime errors / output chunks) =====

export interface StreamChunkEvent {
    type: 'stdout_chunk' | 'stderr_chunk' | 'execute_error' | 'error';
    block_id?: number;
    message?: string;
}
