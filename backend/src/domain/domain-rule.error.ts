export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainRuleError';
  }
}
