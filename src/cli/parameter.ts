export abstract class CommandParameter<Name extends string = string> {
  readonly name: Name;
  readonly usage: string;
  readonly description: string;

  protected constructor(name: Name, usage: string, description: string) {
    this.name = name;
    this.usage = usage;
    this.description = description;
  }
}

export class BooleanParameter<
  Name extends string = string,
> extends CommandParameter<Name> {}

export class ValueParameter<
  Name extends string = string,
> extends CommandParameter<Name> {}

export class RepeatableValueParameter<
  Name extends string = string,
> extends CommandParameter<Name> {}
