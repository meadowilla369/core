export type Listener<T> = (nextState: T, previousState: T) => void;

export class AppStore<T extends object> {
  private state: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState(): T {
    return this.state;
  }

  setState(nextState: T): void {
    const previous = this.state;
    this.state = nextState;
    for (const listener of this.listeners) {
      listener(nextState, previous);
    }
  }

  patch(partial: Partial<T>): void {
    this.setState({ ...this.state, ...partial });
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
