import { correlativoLista, correlativoPaginado } from './correlativo';

describe('Correlativos visuales', () => {
  it('calcula las páginas 1, 2 y 3 sin depender de los identificadores SQL', () => {
    expect(correlativoPaginado(0, 1, 10)).toBe(1);
    expect(correlativoPaginado(0, 2, 10)).toBe(11);
    expect(correlativoPaginado(4, 3, 10)).toBe(25);
  });

  it('respeta un tamaño de página menor o modificado', () => {
    expect(correlativoPaginado(2, 2, 5)).toBe(8);
    expect(correlativoPaginado(1, 3, 20)).toBe(42);
  });

  it('numera listas completas desde uno', () => {
    expect(correlativoLista(0)).toBe(1);
    expect(correlativoLista(3)).toBe(4);
  });
});
