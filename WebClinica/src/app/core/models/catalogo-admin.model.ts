export interface CatalogoAdminColumn {
  key: string;
  label: string;
}

export interface CatalogoAdminRow {
  id: number;
  label: string;
  activa: boolean;
  values: Readonly<Record<string, string>>;
}

