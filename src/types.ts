import type * as ts from "typescript/lib/tsserverlibrary";

export enum InlineValueType {
  VariableLookup = "VariableLookup",
  EvaluatableExpression = "EvaluatableExpression",
}

export interface InlineValueVariableLookup {
  readonly type: InlineValueType.VariableLookup;
  readonly span: ts.TextSpan;
  readonly variableName: string;
}

export interface InlineValueEvaluatableExpression {
  readonly type: InlineValueType.EvaluatableExpression;
  readonly span: ts.TextSpan;
  readonly expression: string;
}

export type InlineValue =
  | InlineValueVariableLookup
  | InlineValueEvaluatableExpression;

export interface InlineValuesContext {
  file: ts.SourceFile;
  position: number;
  program: ts.Program;
  span: ts.TextSpan;
}
