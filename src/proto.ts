import type * as ts from "typescript/lib/tsserverlibrary";

export const enum CommandTypes {
  ProvideInlineValues = "typescript/builtin/provideInlineValues",
}

export interface InlineValuesArgs extends ts.server.protocol.FileRequestArgs {
  /**
   * Zero based position.
   */
  position: number;

  /**
   * Zero based position.
   */
  start: number;
  length: number;
}

export interface InlineValuesRequest {
  command: CommandTypes.ProvideInlineValues;
  arguments: InlineValuesArgs;
}

export interface InlineValuesResponse extends ts.server.protocol.Response {
  body: InlineValue[];
}

export const enum InlineValueType {
  VariableLookup = "VariableLookup",
  EvaluatableExpression = "EvaluatableExpression",
}

export interface InlineValueVariableLookup {
  readonly type: InlineValueType.VariableLookup;
  readonly start: number;
  readonly length: number;
  readonly variableName: string;
}

export interface InlineValueEvaluatableExpression {
  readonly type: InlineValueType.EvaluatableExpression;
  readonly start: number;
  readonly length: number;
  readonly expression: string;
}

export type InlineValue =
  | InlineValueVariableLookup
  | InlineValueEvaluatableExpression;
