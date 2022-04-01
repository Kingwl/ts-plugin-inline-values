export const enum CommandTypes {
    ProvideInlineValues = 'typescript/extra/provideInlineValues'
}

export interface InlineValuesArgs extends ts.server.protocol.FileLocationRequestArgs {
    /**
     * Start position of the span.
     */
    start: number;
    /**
     * Length of the span.
     */
    length: number;
}

export interface InlineValuesRequest extends ts.server.protocol.Request {
    command: CommandTypes.ProvideInlineValues;
    arguments: InlineValuesArgs;
}

export interface InlineValuesResponse extends ts.server.protocol.Response {
    body: InlineValue[]
}

export const enum InlineValueType {
    VariableLookup = 'VariableLookup',
    EvaluatableExpression = 'EvaluatableExpression'
}

export interface InlineValueVariableLookup {
    readonly type: InlineValueType.VariableLookup
    readonly span: ts.server.protocol.TextSpan;
    readonly variableName: string;
}

export interface InlineValueEvaluatableExpression {
    readonly type: InlineValueType.EvaluatableExpression;
    readonly span: ts.server.protocol.TextSpan;
    readonly expression: string;
}

export type InlineValue = InlineValueVariableLookup | InlineValueEvaluatableExpression;