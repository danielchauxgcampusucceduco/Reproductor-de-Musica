import { describe, expect, it } from 'vitest';
import { DoublyLinkedList } from '../src/core/DoublyLinkedList';

function expectLinks(list: DoublyLinkedList<number>, expected: number[]): void {
  expect(list.toArray()).toEqual(expected);
  expect(list.size).toBe(expected.length);
  expect(list.head?.prev ?? null).toBeNull();
  expect(list.tail?.next ?? null).toBeNull();
  let forward = list.head;
  for (const value of expected) {
    expect(forward?.value).toBe(value);
    if (forward?.prev) expect(forward.prev.next).toBe(forward);
    forward = forward?.next ?? null;
  }
  expect(forward).toBeNull();
  let backward = list.tail;
  for (let index = expected.length - 1; index >= 0; index--) {
    expect(backward?.value).toBe(expected[index]);
    if (backward?.next) expect(backward.next.prev).toBe(backward);
    backward = backward?.prev ?? null;
  }
  expect(backward).toBeNull();
}

describe('DoublyLinkedList', () => {
  it('enlaza al inicio, al final y en medio, en ambos sentidos', () => {
    const list = new DoublyLinkedList<number>();
    list.addLast(2);
    list.addFirst(1);
    list.addLast(4);
    list.addAt(2, 3);
    expectLinks(list, [1, 2, 3, 4]);
  });

  it('inserta en una lista vacía y elimina una lista de un solo nodo', () => {
    const list = new DoublyLinkedList<string>();
    expect(list.isEmpty()).toBe(true);
    expect(list.removeFirst()).toBeUndefined();
    expect(list.removeLast()).toBeUndefined();
    list.addFirst('único');
    expect(list.head).toBe(list.tail);
    expect(list.removeLast()).toBe('único');
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.size).toBe(0);
  });

  it('elimina cabeza, cola y un nodo medio y desconecta el nodo extraído', () => {
    const list = new DoublyLinkedList<number>();
    [1, 2, 3, 4].forEach((value) => list.addLast(value));
    const middle = list.getNodeAt(1);
    expect(list.removeNode(middle)).toBe(2);
    expect(middle.prev).toBeNull();
    expect(middle.next).toBeNull();
    expect(list.removeFirst()).toBe(1);
    expect(list.removeLast()).toBe(4);
    expectLinks(list, [3]);
  });

  it('mueve el mismo nodo hacia ambos extremos y al centro', () => {
    const list = new DoublyLinkedList<number>();
    [1, 2, 3, 4].forEach((value) => list.addLast(value));
    const originalNode = list.getNodeAt(0);
    list.moveNode(0, 3);
    expectLinks(list, [2, 3, 4, 1]);
    expect(list.tail).toBe(originalNode);
    list.moveNode(3, 1);
    expectLinks(list, [2, 1, 3, 4]);
    expect(list.getNodeAt(1)).toBe(originalNode);
  });

  it('permite insertar al final y recorre desde la cola para índices cercanos', () => {
    const list = new DoublyLinkedList<number>();
    [1, 2, 3].forEach((value) => list.addLast(value));
    list.addAt(3, 4);
    expect(list.getNodeAt(3).value).toBe(4);
    expect([...list]).toEqual([1, 2, 3, 4]);
    expect(list.indexOf((value) => value === 3)).toBe(2);
    expect(list.findNode((value) => value === 4)).toBe(list.tail);
    expect(list.indexOf((value) => value === 9)).toBe(-1);
  });

  it('desconecta todos los nodos al vaciar y rechaza nodos ajenos', () => {
    const list = new DoublyLinkedList<number>();
    const foreignList = new DoublyLinkedList<number>();
    [1, 2, 3].forEach((value) => list.addLast(value));
    const oldHead = list.head;
    const foreignNode = foreignList.addLast(9);
    expect(() => list.removeNode(foreignNode)).toThrow('no pertenece');
    list.clear();
    expectLinks(list, []);
    expect(oldHead?.next).toBeNull();
    expect(() => list.removeNode(oldHead!)).toThrow('no pertenece');
  });

  it('rechaza índices fuera de rango o no enteros con errores en español', () => {
    const list = new DoublyLinkedList<number>();
    expect(() => list.getNodeAt(0)).toThrow('Índice inválido');
    expect(() => list.removeAt(-1)).toThrow('Índice inválido');
    expect(() => list.addAt(2, 1)).toThrow('Posición inválida');
    list.addLast(1);
    expect(() => list.moveNode(0, 1)).toThrow('Índice inválido');
    expect(() => list.addAt(0.5, 1)).toThrow('Posición inválida');
  });
});
