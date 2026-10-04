export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  /** Roles devueltos por el backend, ej: ['ADMIN'] */
  roles: string[];
}

export interface LoginResponse {
  token: string;
  user: User;
  /** Menú filtrado por roles, construido en el backend */
  menu: import('./menu-item.model').MenuItem[];
}
