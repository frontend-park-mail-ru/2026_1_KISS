export interface BlockData {
    id: string;
    type: string;
    content: string;
}

export interface Notebook {
    id: string;
    title: string;
    updated_at: string;
    owner_username?: string;
    blocks?: BlockData[];
}

export interface UserData {
    username: string;
    email?: string;
}

export interface InputConfig {
    type: string;
    id: string;
    placeholder: string;
    required: boolean;
    pattern: string | null;
    error_by_pattern: string;
    minlength: number | null;
    maxlength: number | null;
}

export interface InputState {
    isValid: boolean;
    value: string;
}

export interface KebabAction {
    name: string;
    label: string;
    handler: () => void;
}

export interface EventListenerRecord {
    element: EventTarget;
    event: string;
    handler: EventListener;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PageConstructor = new (...args: any[]) => { render(): void; destroy?(): void };

export interface RouteDefinition {
    pattern: string;
    regexp: RegExp;
    paramNames: string[];
    PageClass: PageConstructor;
}

export interface RouteMatch {
    PageClass: PageConstructor;
    params: Record<string, string>;
}

export interface GreenHeaderConfig {
    user?: UserData;
    onProfile?: () => void;
    onLogout?: () => void;
}

export interface NotebookHeaderConfig {
    filename?: string;
    user?: UserData;
    onRename?: () => void;
    onProfile?: () => void;
    onLogout?: () => void;
}

export interface FilesPageState {
    notebooks: Notebook[];
    currentPage: number;
    limit: number;
    username: string;
}

export interface FilterSet {
    owner: string | null;
    dateFrom: string | null;
    dateTo: string | null;
}

export type PageChangeCallback = (targetPage: number) => void;

export type FilterChangeCallback = (filters: FilterSet) => void;

export type RenameCallback = (newTitle: string) => Promise<void>;

export interface Comment {
    id: number;
    user_id: number;
    username: string;
    block_id: number;
    text: string;
    created_at: number;
}
