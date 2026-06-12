export class IterationBudget {
  private used = 0;
  private readonly max;

  constructor(max: number) {
    this.max = max;
  }

  consume(): boolean {
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }

  refund(): void {
    if (this.used > 0) this.used--;
  }

  get remaining(): number {
    return this.max - this.used;
  }

  get total(): number {
    return this.max;
  }

  reset(): void {
    this.used = 0;
  }
}
