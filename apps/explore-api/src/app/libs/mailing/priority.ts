export class Priority {
  static LOW = new Priority('Low');
  static MEDIUM = new Priority('Medium');
  static HIGH = new Priority('High');
  static CRITICAL = new Priority('Critical');

  static fromString(value: string): Priority {
    switch (value) {
      case 'Low':
        return Priority.LOW;
      case 'Medium':
        return Priority.MEDIUM;
      case 'High':
        return Priority.HIGH;
      case 'Critical':
        return Priority.CRITICAL;
      default:
        throw new Error(`Priority ${value} not found`);
    }
  }

  private constructor(public value: string) {}

  equals(priority: Priority): boolean {
    return this.value === priority.value;
  }

  asString(): string {
    return this.value;
  }
}
