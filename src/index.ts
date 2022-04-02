import type * as ts from "typescript/lib/tsserverlibrary";
import { inlineValueToProtoInlineValue } from "./convert";
import * as proto from "./proto";
import { createInlineValuesProvider } from "./provider";
import * as types from "./types";
import { isDef } from "./utils";

type Worker = (
  req: proto.InlineValuesRequest
) => proto.InlineValue[] | undefined;

const factory: ts.server.PluginModuleFactory = (mod) => {
  return {
    create(info) {
      const provider = createInlineValuesProvider(mod.typescript);

      const getInlineValueContext = (
        args: proto.InlineValuesArgs
      ): types.InlineValuesContext | undefined => {
        const program = info.languageService.getProgram();
        if (!isDef(program)) {
          return undefined;
        }
        const file = program.getSourceFile(args.file);
        if (!isDef(file)) {
          return undefined;
        }

        const position = args.position;
        return {
          file,
          program,
          position,
          span: args,
        };
      };

      const worker: Worker = (req) => {
        const context = getInlineValueContext(req.arguments);
        if (!context) {
          return undefined;
        }

        const results = provider(context);
        return results.map((item) => inlineValueToProtoInlineValue(item));
      };

      info.session?.addProtocolHandler(
        proto.CommandTypes.ProvideInlineValues,
        (request) => {
          const req = request as proto.InlineValuesRequest;

          return {
            response: worker(req),
          };
        }
      );
      return info.languageService;
    },
  };
};

export = factory;
