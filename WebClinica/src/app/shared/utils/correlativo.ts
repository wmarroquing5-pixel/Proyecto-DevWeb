export function correlativoPaginado(index: number, pagina: number, tamanoPagina: number): number {
  return (pagina - 1) * tamanoPagina + index + 1;
}

export function correlativoLista(index: number): number {
  return index + 1;
}
