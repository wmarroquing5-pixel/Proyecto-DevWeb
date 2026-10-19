// 👇 Debe coincidir EXACTAMENTE con LoginResponse.cs del backend
export interface LoginResponse {
  accessToken: string;   // 👈 NO "token"
  tokenType: string;
  expiresAtUtc: string;
}

export interface User {
  idUsuario: number;
  idRol: number;
  username: string;
  fullName?: string;
  idEmpleado?: number | null;
  roles?: string[];
  id?: number;  // alias para compatibilidad
}