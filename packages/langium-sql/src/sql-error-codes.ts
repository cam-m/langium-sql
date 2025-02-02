/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, DiagnosticInfo, ValidationAcceptor } from "langium";
import * as ast from "./generated/ast";
import { TypeDescriptor } from "./sql-type-descriptors";
import { BinaryOperator, UnaryOperator } from "./sql-type-operators";

type SqlErrorSeverity = "error" | "warning" | "info" | "hint";

class SqlErrorFactory {
    static create<T extends AstNode, P>(
        code: string,
        severity: SqlErrorSeverity,
        messageGenerator: (props: P) => string,
        diagnosticGenerator: (node: T) => DiagnosticInfo<T>
    ): SqlErrorReporter<T, P> {
        const reporter = <SqlErrorReporter<T, P>>((
            node: T,
            props: P,
            accept: ValidationAcceptor
        ) => {
            accept(
                severity,
                messageGenerator(props),
                ((node) => {
                    const info = diagnosticGenerator(node);
                    info.code = code;
                    return info;
                })(node)
            );
        });
        reporter.Code = code;
        return reporter;
    }
}

type SqlErrorReporter<T extends AstNode, P> = {
    (node: T, props: P, accept: ValidationAcceptor): void;
    Code: string;
};

interface Nameable {
    name: string;
}

interface NumericValue {
    value: number;
}

export const ReportAs = {
    DuplicatedVariableName: SqlErrorFactory.create<
        ast.SourceItem,
        Nameable
    >(
        "SQL00001",
        "error",
        ({ name }) => `Duplicated variable name '${name}'.`,
        (node) => ({ node, property: "name" })
    ),
    NumericValueIsNotInteger: SqlErrorFactory.create<
        ast.NumberLiteral,
        NumericValue
    >(
        "SQL00002",
        "error",
        ({ value }) => `Value '${value}' is not an integer.`,
        (node) => ({ node, property: "value" })
    ),
    BinaryOperatorNotDefinedForGivenExpressions: SqlErrorFactory.create<
        ast.BinaryExpression,
        BinaryOperatorMismatch
    >(
        "SQL00003",
        "error",
        ({ op, left, right }) =>
            `Binary operator '${op}' is not defined for ('${left.discriminator}', '${right.discriminator}').`,
        (node) => ({ node, property: "operator" })
    ),
    UnaryOperatorNotDefinedForGivenExpression: SqlErrorFactory.create<
        ast.UnaryExpression,
        UnaryOperatorMismatch
    >(
        "SQL00004",
        "error",
        ({ op, operand }) =>
            `Unary operator '${op}' is not defined for '${operand.discriminator}'.`,
        (node) => ({ node, property: "operator" })
    ),
    ExpressionMustReturnABoolean: SqlErrorFactory.create<
        ast.Expression,
        TypeDescriptor
    >(
        "SQL00005",
        "error",
        (operand) =>
            `Expression must return a boolean, not a '${operand.discriminator}'.`,
        (node) => ({ node })
    ),
    AllStarSelectionRequiresTableSources: SqlErrorFactory.create<
        ast.SimpleSelectStatement,
        {}
    >(
        "SQL00006",
        "error",
        () => `All-star selection requires table sources (FROM is missing).`,
        (node) => ({ node })
    ),
    TableDefinitionRequiresAtLeastOneColumn: SqlErrorFactory.create<
        ast.GlobalReference,
        {}
    >(
        "SQL00007",
        "error",
        () => `Table definition requires at least one column.`,
        (node) => ({ node, property: "element" })
    ),
    SubQueriesWithinSelectStatementsMustHaveExactlyOneColumn:
        SqlErrorFactory.create<ast.SubQueryExpression, {}>(
            "SQL00008",
            "error",
            () =>
                `Sub queries within select statements must have exactly one column.`,
            (node) => ({ node, property: "subQuery" })
        ),
    CannotDeriveTypeOfExpression:
        SqlErrorFactory.create<ast.Expression, {}>(
            "SQL00009",
            "error",
            () =>
                `Unable to derive the type of the expression.`,
            (node) => ({ node })
        ),
    TableOperationUsesTablesWithDifferentColumnCounts:
        SqlErrorFactory.create<ast.BinaryTableExpression, {}>(
            "SQL00010",
            "error",
            () =>
                `This operation uses tables with different amounts of columns, which is forbidden. Please add the missing columns.`,
            (node) => ({ node, property: 'operator' })
        ),
    TableOperationUsesTablesWithDifferentColumnTypes:
        SqlErrorFactory.create<ast.BinaryTableExpression, {columnIndex: number}>(
            "SQL00011",
            "error",
            ({columnIndex}) =>
                `This operation uses tables with different columns types! Compare the columns at index ${columnIndex}. They are not convertable to each other.`,
            (node) => ({ node, property: 'operator' })
        ),
    IncorrectGlobalReferenceTarget:
        SqlErrorFactory.create<ast.GlobalReference, { expected: string, received: string }>(
            "SQL00012",
            "error",
            ({ expected, received }) => `Expected definition of type '${expected}' but received '${received}'.`,
            (node) => ({ node, property: 'element' })
        ),
    UnknownDataType:
        SqlErrorFactory.create<ast.DataType, { dataType: ast.DataType }>(
            "SQL00013",
            "error",
            ({ dataType }) => `Unknown data type '${dataType.dataTypeNames.join(' ')}(${dataType.arguments.map(dt => dt.value).join(', ')})'.`,
            (node) => ({ node })
        )
};

export interface BinaryOperatorMismatch {
    op: BinaryOperator;
    left: TypeDescriptor;
    right: TypeDescriptor;
}

export interface UnaryOperatorMismatch {
    op: UnaryOperator;
    operand: TypeDescriptor;
}
