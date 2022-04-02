import * as proto from "./proto";
import * as types from "./types";

export function inlineValueToProtoInlineValue(
  inlineValue: types.InlineValue
): proto.InlineValue {
  if (inlineValue.type === types.InlineValueType.EvaluatableExpression) {
    return {
      type: proto.InlineValueType.EvaluatableExpression,
      start: inlineValue.span.start,
      length: inlineValue.span.length,
      expression: inlineValue.expression,
    };
  } else {
    return {
      type: proto.InlineValueType.VariableLookup,
      start: inlineValue.span.start,
      length: inlineValue.span.length,
      variableName: inlineValue.variableName,
    };
  }
}
