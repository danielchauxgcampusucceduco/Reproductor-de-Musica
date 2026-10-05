const nodeOwners = new WeakMap<object, object>();

/** Nodo que conserva enlaces reales hacia los elementos vecinos. */
export class DoublyLinkedNode<T> {
  /** Dato almacenado en este nodo. */
  public value: T;
  /** Nodo anterior de la cadena o null en la cabeza. */
  public prev: DoublyLinkedNode<T> | null = null;
  /** Nodo siguiente de la cadena o null en la cola. */
  public next: DoublyLinkedNode<T> | null = null;
  /** Crea un nodo con valor y propietario opcional. */
  public constructor(value: T, owner: object | null = null) {
    this.value = value;
    if (owner) nodeOwners.set(this, owner);
  }

  /** @internal Comprueba la propiedad sin recorrer la lista. */
  public belongsTo(owner: object): boolean { return nodeOwners.get(this) === owner; }

  /** @internal Actualiza la propiedad del nodo al enlazarlo o desconectarlo. */
  public setOwner(owner: object | null): void {
    if (owner) nodeOwners.set(this, owner);
    else nodeOwners.delete(this);
  }
}
