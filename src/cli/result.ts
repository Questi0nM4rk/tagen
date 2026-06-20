export class CommandResult {
  static readonly SUCCESS = Object.freeze(new CommandResult(0));

  readonly exitCode: number;

  private constructor(exitCode: number) {
    this.exitCode = exitCode;
  }

  static failure(exitCode: number): CommandResult {
    if (!Number.isInteger(exitCode) || exitCode <= 0 || exitCode > 255) {
      throw new Error(`invalid CLI exit code: ${exitCode}`);
    }
    return Object.freeze(new CommandResult(exitCode));
  }

  apply(): void {
    process.exitCode = this.exitCode;
  }
}
