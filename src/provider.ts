import type * as ts from 'typescript';
import type * as tsserver from 'typescript/lib/tsserverlibrary';
import { assert, assertTs } from './utils';

type ProvideableScope =
    ts.SourceFile |
    ts.Block |
    ts.IfStatement |
    ts.ForStatement |
    ts.WhileStatement |
    ts.DoStatement |
    ts.SwitchStatement |
    ts.ClassStaticBlockDeclaration |
    ts.ModuleDeclaration |
    ts.AccessorDeclaration |
    ts.CatchClause |
    ts.CaseOrDefaultClause |
    ts.ForInOrOfStatement |
    ts.FunctionLikeDeclaration |
    ts.ClassLikeDeclaration;

type AssignmentLikeExpression = ts.AssignmentExpression<ts.AssignmentOperatorToken> | ts.PrefixUnaryExpression | ts.PostfixUnaryExpression;

export enum TSInlineValueType {
    VariableLookup = "VariableLookup",
    EvaluatableExpression = "EvaluatableExpression"
}

export interface TSInlineValueVariableLookup {
    readonly type: TSInlineValueType.VariableLookup;
    readonly span: ts.TextSpan;
    readonly variableName: string;
}

export interface TSInlineValueEvaluatableExpression {
    readonly type: TSInlineValueType.EvaluatableExpression;
    readonly span: ts.TextSpan;
    readonly expression: string;
}

export type TSInlineValue = TSInlineValueVariableLookup | TSInlineValueEvaluatableExpression;

export interface InlineValuesContext {
    file: tsserver.SourceFile;
    position: number;
    program: tsserver.Program;
    span: ts.TextSpan;
    host: tsserver.LanguageServiceHost;
}

export function createInlineValuesProvider (typescript: typeof ts | typeof tsserver) {
    assertTs(typescript);

    /**
     * We think block is not a 'strong scope' because many statement/expression/etc has shadow block.
     * We should try to ignore them to provide more useful info.
     * But we also need to limit max scope for performance reason.
     */
    const maxStrongScopeCount = 2;
    const maxScopeCount = 4;

    return function provideInlineValues(context: InlineValuesContext): TSInlineValue[] {
        const ts = typescript

        const { file, span, position } = context;

        const currentToken = ts.getTokenAtPosition(file as unknown as ts.SourceFile, position);
        const scopes = findScopes(currentToken);
        const topLevelScope = ts.lastOrUndefined(scopes);
        if (!topLevelScope) {
            return [];
        }

        const scopeSet = new Set<ts.Node>(scopes);
        const values: TSInlineValue[] = [];
        visitor(topLevelScope);
        return values;

        function appendEvaluatableExpressionValue(expr: ts.Expression, ignorePosition?: boolean): void {
            if (ignorePosition || expr.end <= currentToken.pos) {
                const printer = ts.createPrinter({ removeComments: true, omitTrailingSemicolon: true });
                const text = ts.usingSingleLineStringWriter(writer => printer.writeNode(ts.EmitHint.Unspecified, expr, expr.getSourceFile(), writer));
                values.push({
                    type: TSInlineValueType.EvaluatableExpression,
                    span: ts.createTextSpanFromNode(expr),
                    expression: text
                });
            }
        }

        function appendVariableLookup(name: ts.Identifier): void {
            if (name.end <= currentToken.pos) {
                values.push({
                    type: TSInlineValueType.VariableLookup,
                    span: ts.createTextSpanFromNode(name),
                    variableName: name.text
                });
            }
        }

        function visitor(node: ts.Node | undefined): true | undefined {
            if (!node || node.getFullWidth() === 0) {
                return;
            }

            if (!scopeSet.has(node)) {
                if (node.pos > currentToken.pos) {
                    return;
                }

                if (ts.isBlock(node)) {
                    return;
                }
            }

            if (!ts.textSpanIntersectsWith(span, node.pos, node.getFullWidth())) {
                return;
            }

            if (ts.isTypeNode(node)) {
                return;
            }

            switch (node.kind) {
                case ts.SyntaxKind.VariableDeclaration:
                case ts.SyntaxKind.Parameter:
                case ts.SyntaxKind.BindingElement:
                    visitVariableLikeDeclaration(node as ts.VariableDeclaration | ts.ParameterDeclaration | ts.BindingElement);
                    break;
                case ts.SyntaxKind.PropertyAssignment:
                    visitPropertyAssignment(node as ts.PropertyAssignment);
                    break;
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    visitShorthandPropertyAssignment(node as ts.ShorthandPropertyAssignment);
                    break;
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                    visitFunctionLike(node as ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction);
                    break;
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    visitClassLike(node as ts.ClassLikeDeclaration);
                    break;
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                    visitForInOrOfStatement(node as ts.ForInOrOfStatement);
                    break;
                case ts.SyntaxKind.IfStatement:
                    visitIfStatement(node as ts.IfStatement);
                    break;
                case ts.SyntaxKind.ForStatement:
                    visitForStatement(node as ts.ForStatement);
                    break;
                case ts.SyntaxKind.WhileStatement:
                    visitWhileStatement(node as ts.WhileStatement);
                    break;
                case ts.SyntaxKind.DoStatement:
                    visitDoStatement(node as ts.DoStatement);
                    break;
                case ts.SyntaxKind.SwitchStatement:
                    visitSwitchStatement(node as ts.SwitchStatement);
                    break;
                case ts.SyntaxKind.CatchClause:
                    visitCatchClause(node as ts.CatchClause);
                    break;
                case ts.SyntaxKind.CaseClause:
                    visitCaseOrDefaultClause(node as ts.CaseClause);
                    break;
                case ts.SyntaxKind.PrefixUnaryExpression:
                case ts.SyntaxKind.PostfixUnaryExpression:
                    visitPrefixOrPostfixUnaryExpression(node as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression);
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    visitBinaryExpression(node as ts.BinaryExpression);
                    break;
                default:
                    ts.forEachChild(node, visitor);
                    break;
            }
        }

        function visitVariableLikeDeclaration(decl: ts.VariableDeclaration | ts.ParameterDeclaration | ts.BindingElement) {
            if (!decl.name) {
                return;
            }

            if (ts.isIdentifier(decl.name)) {
                appendVariableLookup(decl.name);
            }
            else {
                visitor(decl.name);
            }
            visitor(decl.initializer);
        }

        function visitPropertyAssignment(assignment: ts.PropertyAssignment) {
            appendEvaluatableExpressionValue(assignment.initializer);
        }

        function visitShorthandPropertyAssignment(assignment: ts.ShorthandPropertyAssignment) {
            appendEvaluatableExpressionValue(assignment.name);
        }

        function visitCaseOrDefaultClause(clause: ts.CaseOrDefaultClause) {
            if (ts.isCaseClause(clause)) {
                appendEvaluatableExpressionValue(clause.expression, /*ignorePosition*/ true);
            }
            clause.statements.forEach(visitor);
        }

        function visitAssignmentLikeExpression(expr: AssignmentLikeExpression) {
            assert(isAssignmentLikeExpression(expr), "Must be assignment like expression.");

            const target = ts.isAssignmentExpression(expr) ? expr.left : expr.operand;
            if (ts.isIdentifier(target)) {
                appendVariableLookup(target);
            }
            else if (ts.isAccessExpression(target)) {
                appendEvaluatableExpressionValue(target);
            }

            if (ts.isAssignmentExpression(expr)) {
                visitor(expr.right);
            }
        }

        function visitPrefixOrPostfixUnaryExpression(expr: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression) {
            if (ts.isUnaryExpressionWithWrite(expr)) {
                visitAssignmentLikeExpression(expr);
            }
            else {
                ts.forEachChild(expr, visitor);
            }
        }

        function visitBinaryExpression(expr: ts.BinaryExpression) {
            if (ts.isAssignmentExpression(expr)) {
                visitAssignmentLikeExpression(expr);
            }
            else {
                ts.forEachChild(expr, visitor);
            }
        }

        function visitIfStatement(stmt: ts.IfStatement) {
            if (ts.isParenthesizedExpression(stmt.expression) && isAssignmentLikeExpression(stmt.expression.expression)) {
                visitor(stmt.expression);
            }
            else {
                appendEvaluatableExpressionValue(stmt.expression);
            }

            if (!scopeSet.has(stmt)) {
                return;
            }

            visitor(stmt.thenStatement);
            visitor(stmt.elseStatement);
        }

        function visitForInitializer(initializer: ts.ForInitializer) {
            if (ts.isVariableDeclarationList(initializer)) {
                initializer.declarations.forEach(visitVariableLikeDeclaration);
            }
            else {
                appendEvaluatableExpressionValue(initializer);
            }
        }

        function visitForStatement(stmt: ts.ForStatement) {
            if (!scopeSet.has(stmt)) {
                return;
            }

            if (stmt.initializer) {
                visitForInitializer(stmt.initializer);
            }
            if (stmt.condition) {
                appendEvaluatableExpressionValue(stmt.condition);
            }
            if (stmt.incrementor) {
                /**
                 * We may use comma expression to combine multiple incrementor.
                 */
                if (isAssignmentLikeExpression(stmt.incrementor) || ts.isBinaryExpression(stmt.incrementor) && stmt.incrementor.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                    visitor(stmt.incrementor);
                }
                else {
                    appendEvaluatableExpressionValue(stmt.incrementor);
                }
            }

            visitor(stmt.statement);
        }

        function visitWhileStatement(stmt: ts.WhileStatement) {
            appendEvaluatableExpressionValue(stmt.expression);

            if (!scopeSet.has(stmt)) {
                return;
            }

            visitor(stmt.statement);
        }

        function visitDoStatement(stmt: ts.DoStatement) {
            appendEvaluatableExpressionValue(stmt.expression);

            if (!scopeSet.has(stmt)) {
                return;
            }

            visitor(stmt.statement);
        }

        function visitSwitchStatement(stmt: ts.SwitchStatement) {
            appendEvaluatableExpressionValue(stmt.expression);

            if (!scopeSet.has(stmt)) {
                return;
            }

            stmt.caseBlock.clauses.forEach(visitCaseOrDefaultClause);
        }

        function visitCatchClause(clause: ts.CatchClause) {
            if (!scopeSet.has(clause)) {
                return;
            }

            if (clause.variableDeclaration) {
                visitVariableLikeDeclaration(clause.variableDeclaration);
            }
            visitor(clause.block);
        }

        function visitFunctionLike(node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction) {
            if (ts.isFunctionDeclaration(node) && node.name) {
                appendVariableLookup(node.name);
            }

            if (!scopeSet.has(node)) {
                return;
            }

            node.parameters.forEach(visitVariableLikeDeclaration);
            visitor(node.body);
        }

        function visitClassLike(node: ts.ClassLikeDeclaration) {
            // TODO: support class members;
            if (ts.isClassDeclaration(node) && node.name) {
                appendVariableLookup(node.name);
            }

            if (!scopeSet.has(node)) {
                return;
            }

            node.members.forEach(visitor);
        }

        function visitForInOrOfStatement(stmt: ts.ForInOrOfStatement) {
            if (!scopeSet.has(stmt)) {
                return;
            }

            visitForInitializer(stmt.initializer);
            appendEvaluatableExpressionValue(stmt.expression);
            visitor(stmt.statement);
        }
    }

    function isProvideableScope(node: ts.Node): node is ProvideableScope {
        const ts = typescript;
        assertTs(ts)

        if (ts.isFunctionLikeDeclaration(node) || ts.isAccessExpression(node) || ts.isClassLike(node) || ts.isForInOrOfStatement(node) || ts.isCaseOrDefaultClause(node)) {
            return true;
        }

        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
            case ts.SyntaxKind.Block:
            case ts.SyntaxKind.ClassStaticBlockDeclaration:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.DoStatement:
            case ts.SyntaxKind.SwitchStatement:
            case ts.SyntaxKind.ModuleDeclaration:
            case ts.SyntaxKind.CatchClause:
                return true;
            default:
                return false;
        }
    }

    function findScopes(node: ts.Node): ProvideableScope[] {
        const ts = typescript
        assertTs(ts)

        const results: ProvideableScope[] = [];
        let scopeCount = 0;

        ts.findAncestor(node, node => {
            if (scopeCount >= maxStrongScopeCount || results.length >= maxScopeCount) {
                return "quit";
            }

            if (isProvideableScope(node)) {
                results.push(node);

                if (!ts.isBlock(node)) {
                    scopeCount++;
                }
            }

            return false;
        });

        return results;
    }

    function isAssignmentLikeExpression(expr: ts.Expression): expr is AssignmentLikeExpression {
        const ts = typescript
        assertTs(ts)

        return ts.isAssignmentExpression(expr) || ts.isUnaryExpressionWithWrite(expr);
    }
}