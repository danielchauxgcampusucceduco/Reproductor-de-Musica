import { DoublyLinkedNode } from './DoublyLinkedNode';

/** Lista genérica que almacena los valores en nodos enlazados en ambas direcciones. */
export class DoublyLinkedList<T> implements Iterable<T> {
  private first: DoublyLinkedNode<T> | null = null;
  private last: DoublyLinkedNode<T> | null = null;
  private count = 0;
  readonly #ownerToken = {};

  /** O(1). Devuelve la cabeza de la lista. */
  public get head(): DoublyLinkedNode<T> | null {
    return this.first;
  }

  /** O(1). Devuelve la cola de la lista. */
  public get tail(): DoublyLinkedNode<T> | null {
    return this.last;
  }

  /** O(1). Devuelve el número de nodos enlazados. */
  public get size(): number {
    return this.count;
  }

  /** O(1). Inserta un valor antes de la cabeza. */
  public addFirst(value: T): DoublyLinkedNode<T> {
    return this.insertBefore(this.first, value);
  }

  /** O(1). Inserta un valor después de la cola. */
  public addLast(value: T): DoublyLinkedNode<T> {
    return this.insertAfter(this.last, value);
  }

  /** O(n). Inserta en un índice entre cero y size, buscando desde el extremo más cercano. */
  public addAt(index: number, value: T): DoublyLinkedNode<T> {
    this.assertInsertIndex(index);
    if (index === this.count) return this.addLast(value);
    return this.insertBefore(this.getNodeAt(index), value);
  }

  /** O(1). Elimina y devuelve la cabeza, o undefined si la lista está vacía. */
  public removeFirst(): T | undefined {
    return this.first ? this.removeNode(this.first) : undefined;
  }

  /** O(1). Elimina y devuelve la cola, o undefined si la lista está vacía. */
  public removeLast(): T | undefined {
    return this.last ? this.removeNode(this.last) : undefined;
  }

  /** O(n). Elimina y devuelve el valor en el índice indicado. */
  public removeAt(index: number): T {
    return this.removeNode(this.getNodeAt(index));
  }

  /** O(1). Desconecta un nodo de esta lista y devuelve su valor. */
  public removeNode(node: DoublyLinkedNode<T>): T {
    if (!this.belongsToList(node)) {
      throw new Error('El nodo no pertenece a esta lista.');
    }

    const { prev, next } = node;
    if (prev) prev.next = next;
    else this.first = next;

    if (next) next.prev = prev;
    else this.last = prev;

    node.prev = null;
    node.next = null;
    node.setOwner(null);
    this.count -= 1;
    return node.value;
  }

  /** O(n). Devuelve el nodo de un índice válido, empezando desde el extremo más próximo. */
  public getNodeAt(index: number): DoublyLinkedNode<T> {
    this.assertIndex(index);
    if (index < this.count / 2) return this.getNodeFromHead(index);
    return this.getNodeFromTail(index);
  }

  /** O(n). Devuelve el primer nodo cuyo valor cumple la condición. */
  public findNode(predicate: (value: T) => boolean): DoublyLinkedNode<T> | null {
    for (let node = this.first; node; node = node.next) {
      if (predicate(node.value)) return node;
    }
    return null;
  }

  /** O(n). Devuelve el índice de la primera coincidencia o -1 si no existe. */
  public indexOf(predicate: (value: T) => boolean): number {
    let index = 0;
    for (const value of this) {
      if (predicate(value)) return index;
      index += 1;
    }
    return -1;
  }

  /** O(n). Mueve el mismo nodo a otro índice sin crear un nodo nuevo. */
  public moveNode(fromIndex: number, toIndex: number): void {
    this.assertIndex(fromIndex);
    this.assertIndex(toIndex);
    if (fromIndex === toIndex) return;

    const node = this.getNodeAt(fromIndex);
    this.detach(node);
    if (toIndex >= this.count) this.attachAfter(this.last, node);
    else this.attachBefore(this.getNodeAt(toIndex), node);
  }

  /** O(n). Desconecta todos los nodos y deja la lista vacía. */
  public clear(): void {
    for (let node = this.first; node;) {
      const next = node.next;
      node.prev = null;
      node.next = null;
      node.setOwner(null);
      node = next;
    }
    this.first = null;
    this.last = null;
    this.count = 0;
  }

  /** O(1). Indica si no hay nodos en la lista. */
  public isEmpty(): boolean {
    return this.count === 0;
  }

  /** O(n). Crea la vista en arreglo requerida para renderizar o persistir la lista. */
  public toArray(): T[] {
    return [...this];
  }

  /** O(n). Itera los valores desde la cabeza hasta la cola. */
  public *[Symbol.iterator](): Iterator<T> {
    for (let node = this.first; node; node = node.next) yield node.value;
  }

  private getNodeFromHead(index: number): DoublyLinkedNode<T> {
    let node = this.first!;
    for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
      node = node.next!;
    }
    return node;
  }

  private getNodeFromTail(index: number): DoublyLinkedNode<T> {
    let node = this.last!;
    for (let currentIndex = this.count - 1; currentIndex > index; currentIndex -= 1) {
      node = node.prev!;
    }
    return node;
  }

  private insertBefore(reference: DoublyLinkedNode<T> | null, value: T): DoublyLinkedNode<T> {
    const node = new DoublyLinkedNode(value, this.#ownerToken);
    if (!reference) {
      if (this.last) {
        node.prev = this.last;
        this.last.next = node;
        this.last = node;
      } else {
        this.first = node;
        this.last = node;
      }
    } else {
      node.next = reference;
      node.prev = reference.prev;
      if (reference.prev) reference.prev.next = node;
      else this.first = node;
      reference.prev = node;
    }
    this.count += 1;
    return node;
  }

  private insertAfter(reference: DoublyLinkedNode<T> | null, value: T): DoublyLinkedNode<T> {
    if (!reference) return this.insertBefore(null, value);

    const node = new DoublyLinkedNode(value, this.#ownerToken);
    node.prev = reference;
    node.next = reference.next;
    if (reference.next) reference.next.prev = node;
    else this.last = node;
    reference.next = node;
    this.count += 1;
    return node;
  }

  private belongsToList(node: DoublyLinkedNode<T>): boolean {
    return node.belongsTo(this.#ownerToken);
  }

  private detach(node: DoublyLinkedNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.first = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.last = node.prev;
    node.prev = null;
    node.next = null;
    this.count -= 1;
  }

  private attachBefore(reference: DoublyLinkedNode<T>, node: DoublyLinkedNode<T>): void {
    node.setOwner(this.#ownerToken);
    node.next = reference;
    node.prev = reference.prev;
    if (reference.prev) reference.prev.next = node;
    else this.first = node;
    reference.prev = node;
    this.count += 1;
  }

  private attachAfter(reference: DoublyLinkedNode<T> | null, node: DoublyLinkedNode<T>): void {
    node.setOwner(this.#ownerToken);
    if (!reference) {
      this.first = node;
      this.last = node;
    } else {
      node.prev = reference;
      reference.next = node;
      this.last = node;
    }
    this.count += 1;
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.count) {
      throw new RangeError(`Índice inválido: ${index}. Debe estar entre 0 y ${this.count - 1}.`);
    }
  }

  private assertInsertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > this.count) {
      throw new RangeError(`Posición inválida: ${index}. Debe estar entre 0 y ${this.count}.`);
    }
  }
}
