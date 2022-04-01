import * as ts from 'typescript/lib/tsserverlibrary'
import * as Proto from './proto'
import { createInlineValuesProvider, InlineValuesContext } from './provider'

const factory: ts.server.PluginModuleFactory = (mod) => {
    return {
        create(info) {
            const provider = createInlineValuesProvider(mod.typescript);

            info.session?.addProtocolHandler(Proto.CommandTypes.ProvideInlineValues, (request) => {
                const req = request as Proto.InlineValuesRequest

                const host = info.languageServiceHost;
                
                const program = info.languageService.getProgram()!
                const file = program?.getSourceFile(req.arguments.file)!;

                const position = file.getPositionOfLineAndCharacter(req.arguments.line, req.arguments.offset);

                const context: InlineValuesContext = {
                    program,
                    file,
                    host,
                    position,
                    span: ts.createTextSpan(
                        req.arguments.start,
                        req.arguments.length
                    )
                }
                const results = provider(context)
                return {
                    response: {
                        body: results.map(item => {
                            return item as Proto.InlineValue
                        }) as Proto.InlineValue[]
                    }
                }
            })
            return info.languageService
        }
    }
}

export = factory;