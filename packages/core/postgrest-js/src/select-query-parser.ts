// Credits to @bnjmnt4n (https://www.npmjs.com/package/postgrest-query)

import { GenericSchema, Prettify } from './types'

type Whitespace = ' ' | '\n' | '\t'

type LowerAlphabet =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'

type Alphabet = LowerAlphabet | Uppercase<LowerAlphabet>

type Digit = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0'

type Letter = Alphabet | Digit | '_'

type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

/**
 * Parser errors.
 */
type ParserError<Message extends string> = { error: true } & Message
type GenericStringError = ParserError<'Received a generic string'>
export type SelectQueryError<Message extends string> = { error: true } & Message

/**
 * Trims whitespace from the left of the input.
 */
type EatWhitespace<Input extends string> = string extends Input
  ? GenericStringError
  : Input extends `${Whitespace}${infer Remainder}`
  ? EatWhitespace<Remainder>
  : Input

type HasFKey<FKeyName, Relationships> = Relationships extends [infer R]
  ? R extends { foreignKeyName: FKeyName }
    ? true
    : false
  : Relationships extends [infer R, ...infer Rest]
  ? HasFKey<FKeyName, [R]> extends true
    ? true
    : HasFKey<FKeyName, Rest>
  : false

type HasUniqueFKey<FKeyName, Relationships> = Relationships extends [infer R]
  ? R extends { foreignKeyName: FKeyName; isOneToOne: true }
    ? true
    : false
  : Relationships extends [infer R, ...infer Rest]
  ? HasUniqueFKey<FKeyName, [R]> extends true
    ? true
    : HasUniqueFKey<FKeyName, Rest>
  : false

type HasFKeyToFRel<FRelName, Relationships> = Relationships extends [infer R]
  ? R extends { referencedRelation: FRelName }
    ? true
    : false
  : Relationships extends [infer R, ...infer Rest]
  ? HasFKeyToFRel<FRelName, [R]> extends true
    ? true
    : HasFKeyToFRel<FRelName, Rest>
  : false

type HasUniqueFKeyToFRel<FRelName, Relationships> = Relationships extends [infer R]
  ? R extends { referencedRelation: FRelName; isOneToOne: true }
    ? true
    : false
  : Relationships extends [infer R, ...infer Rest]
  ? HasUniqueFKeyToFRel<FRelName, [R]> extends true
    ? true
    : HasUniqueFKeyToFRel<FRelName, Rest>
  : false

/**
 * Constructs a type definition for a single field of an object.
 *
 * @param Definitions Record of definitions, possibly generated from PostgREST's OpenAPI spec.
 * @param Name Name of the table being queried.
 * @param Field Single field parsed by `ParseQuery`.
 */
type ConstructFieldDefinition<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName,
  Relationships,
  Field
> = Field extends { star: true }
  ? Row
  : Field extends { name: string; original: string; hint: string; children: unknown[] }
  ? {
      [_ in Field['name']]: GetResultHelper<
        Schema,
        (Schema['Tables'] & Schema['Views'])[Field['original']]['Row'],
        Field['original'],
        (Schema['Tables'] & Schema['Views'])[Field['original']] extends { Relationships: infer R }
          ? R
          : unknown,
        Field['children'],
        unknown
      > extends infer Child
        ? // One-to-one relationship - referencing column(s) has unique/pkey constraint.
          HasUniqueFKey<
            Field['hint'],
            (Schema['Tables'] & Schema['Views'])[Field['original']] extends {
              Relationships: infer R
            }
              ? R
              : unknown
          > extends true
          ? Child | null
          : Relationships extends unknown[]
          ? HasFKey<Field['hint'], Relationships> extends true
            ? Child | null
            : Child[]
          : Child[]
        : never
    }
  : Field extends { name: string; original: string; children: unknown[] }
  ? {
      [_ in Field['name']]: GetResultHelper<
        Schema,
        (Schema['Tables'] & Schema['Views'])[Field['original']]['Row'],
        Field['original'],
        (Schema['Tables'] & Schema['Views'])[Field['original']] extends { Relationships: infer R }
          ? R
          : unknown,
        Field['children'],
        unknown
      > extends infer Child
        ? // One-to-one relationship - referencing column(s) has unique/pkey constraint.
          HasUniqueFKeyToFRel<
            RelationName,
            (Schema['Tables'] & Schema['Views'])[Field['original']] extends {
              Relationships: infer R
            }
              ? R
              : unknown
          > extends true
          ? Child | null
          : Relationships extends unknown[]
          ? HasFKeyToFRel<Field['original'], Relationships> extends true
            ? Child | null
            : Child[]
          : Child[]
        : never
    }
  : Field extends { name: string; original: string }
  ? Field['original'] extends keyof Row
    ? { [K in Field['name']]: Row[Field['original']] }
    : SelectQueryError<`Referencing missing column \`${Field['original']}\``>
  : Field extends { name: string; type: infer T }
  ? { [K in Field['name']]: T }
  : Record<string, unknown>

/**
 * Notes: all `Parse*` types assume that their input strings have their whitespace
 * removed. They return tuples of ["Return Value", "Remainder of text"] or
 * a `ParserError`.
 */

/**
 * Reads a consecutive sequence of more than 1 letter,
 * where letters are `[0-9a-zA-Z_]`.
 */
type ReadLetters<Input extends string> = string extends Input
  ? GenericStringError
  : ReadLettersHelper<Input, ''> extends [`${infer Letters}`, `${infer Remainder}`]
  ? Letters extends ''
    ? ParserError<`Expected letter at \`${Input}\``>
    : [Letters, Remainder]
  : ReadLettersHelper<Input, ''>

type ReadLettersHelper<Input extends string, Acc extends string> = string extends Input
  ? GenericStringError
  : Input extends `${infer L}${infer Remainder}`
  ? L extends Letter
    ? ReadLettersHelper<Remainder, `${Acc}${L}`>
    : [Acc, Input]
  : [Acc, '']

/**
 * Reads a consecutive sequence of more than 1 double-quoted letters,
 * where letters are `[^"]`.
 */
type ReadQuotedLetters<Input extends string> = string extends Input
  ? GenericStringError
  : Input extends `"${infer Remainder}`
  ? ReadQuotedLettersHelper<Remainder, ''> extends [`${infer Letters}`, `${infer Remainder}`]
    ? Letters extends ''
      ? ParserError<`Expected string at \`${Remainder}\``>
      : [Letters, Remainder]
    : ReadQuotedLettersHelper<Remainder, ''>
  : ParserError<`Not a double-quoted string at \`${Input}\``>

type ReadQuotedLettersHelper<Input extends string, Acc extends string> = string extends Input
  ? GenericStringError
  : Input extends `${infer L}${infer Remainder}`
  ? L extends '"'
    ? [Acc, Remainder]
    : ReadQuotedLettersHelper<Remainder, `${Acc}${L}`>
  : ParserError<`Missing closing double-quote in \`"${Acc}${Input}\``>

/**
 * Parses a (possibly double-quoted) identifier.
 * For now, identifiers are just sequences of more than 1 letter.
 */
type ParseIdentifier<Input extends string> = ReadLetters<Input> extends [
  infer Name,
  `${infer Remainder}`
]
  ? [Name, `${Remainder}`]
  : ReadQuotedLetters<Input> extends [infer Name, `${infer Remainder}`]
  ? [Name, `${Remainder}`]
  : ParserError<`No (possibly double-quoted) identifier at \`${Input}\``>

/**
 * Parses a node.
 * A node is one of the following:
 * - `*`
 * - `field`
 * - `field->json...`
 * - `field(nodes)`
 * - `field!hint(nodes)`
 * - `field!inner(nodes)`
 * - `field!hint!inner(nodes)`
 * - `renamed_field:field`
 * - `renamed_field:field->json...`
 * - `renamed_field:field(nodes)`
 * - `renamed_field:field!hint(nodes)`
 * - `renamed_field:field!inner(nodes)`
 * - `renamed_field:field!hint!inner(nodes)`
 *
 * TODO: casting operators `::text`, more support for JSON operators `->`, `->>`.
 */
type ParseNode<Input extends string> = Input extends ''
  ? ParserError<'Empty string'>
  : // `*`
  Input extends `*${infer Remainder}`
  ? [{ star: true }, EatWhitespace<Remainder>]
  : ParseIdentifier<Input> extends [infer Name, `${infer Remainder}`]
  ? EatWhitespace<Remainder> extends `!inner${infer Remainder}`
    ? ParseEmbeddedResource<EatWhitespace<Remainder>> extends [infer Fields, `${infer Remainder}`]
      ? // `field!inner(nodes)`
        [{ name: Name; original: Name; children: Fields }, EatWhitespace<Remainder>]
      : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
      ? ParseEmbeddedResource<EatWhitespace<Remainder>>
      : ParserError<'Expected embedded resource after `!inner`'>
    : EatWhitespace<Remainder> extends `!${infer Remainder}`
    ? ParseIdentifier<EatWhitespace<Remainder>> extends [infer Hint, `${infer Remainder}`]
      ? EatWhitespace<Remainder> extends `!inner${infer Remainder}`
        ? ParseEmbeddedResource<EatWhitespace<Remainder>> extends [
            infer Fields,
            `${infer Remainder}`
          ]
          ? // `field!hint!inner(nodes)`
            [{ name: Name; original: Name; hint: Hint; children: Fields }, EatWhitespace<Remainder>]
          : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
          ? ParseEmbeddedResource<EatWhitespace<Remainder>>
          : ParserError<'Expected embedded resource after `!inner`'>
        : ParseEmbeddedResource<EatWhitespace<Remainder>> extends [
            infer Fields,
            `${infer Remainder}`
          ]
        ? // `field!hint(nodes)`
          [{ name: Name; original: Name; hint: Hint; children: Fields }, EatWhitespace<Remainder>]
        : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
        ? ParseEmbeddedResource<EatWhitespace<Remainder>>
        : ParserError<'Expected embedded resource after `!hint`'>
      : ParserError<'Expected identifier after `!`'>
    : EatWhitespace<Remainder> extends `:${infer Remainder}`
    ? ParseIdentifier<EatWhitespace<Remainder>> extends [infer OriginalName, `${infer Remainder}`]
      ? EatWhitespace<Remainder> extends `!inner${infer Remainder}`
        ? ParseEmbeddedResource<EatWhitespace<Remainder>> extends [
            infer Fields,
            `${infer Remainder}`
          ]
          ? // `renamed_field:field!inner(nodes)`
            [{ name: Name; original: OriginalName; children: Fields }, EatWhitespace<Remainder>]
          : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
          ? ParseEmbeddedResource<EatWhitespace<Remainder>>
          : ParserError<'Expected embedded resource after `!inner`'>
        : EatWhitespace<Remainder> extends `!${infer Remainder}`
        ? ParseIdentifier<EatWhitespace<Remainder>> extends [infer Hint, `${infer Remainder}`]
          ? EatWhitespace<Remainder> extends `!inner${infer Remainder}`
            ? ParseEmbeddedResource<EatWhitespace<Remainder>> extends [
                infer Fields,
                `${infer Remainder}`
              ]
              ? // `renamed_field:field!hint!inner(nodes)`
                [
                  { name: Name; original: OriginalName; hint: Hint; children: Fields },
                  EatWhitespace<Remainder>
                ]
              : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
              ? ParseEmbeddedResource<EatWhitespace<Remainder>>
              : ParserError<'Expected embedded resource after `!inner`'>
            : ParseEmbeddedResource<EatWhitespace<Remainder>> extends [
                infer Fields,
                `${infer Remainder}`
              ]
            ? // `renamed_field:field!hint(nodes)`
              [
                {
                  name: Name
                  original: OriginalName
                  hint: Hint
                  children: Fields
                },
                EatWhitespace<Remainder>
              ]
            : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
            ? ParseEmbeddedResource<EatWhitespace<Remainder>>
            : ParserError<'Expected embedded resource after `!hint`'>
          : ParserError<'Expected identifier after `!`'>
        : ParseEmbeddedResource<EatWhitespace<Remainder>> extends [
            infer Fields,
            `${infer Remainder}`
          ]
        ? // `renamed_field:field(nodes)`
          [{ name: Name; original: OriginalName; children: Fields }, EatWhitespace<Remainder>]
        : ParseJsonAccessor<EatWhitespace<Remainder>> extends [
            infer _PropertyName,
            infer PropertyType,
            `${infer Remainder}`
          ]
        ? // `renamed_field:field->json...`
          [{ name: Name; type: PropertyType }, EatWhitespace<Remainder>]
        : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
        ? ParseEmbeddedResource<EatWhitespace<Remainder>>
        : // `renamed_field:field`
          [{ name: Name; original: OriginalName }, EatWhitespace<Remainder>]
      : ParseIdentifier<EatWhitespace<Remainder>>
    : ParseEmbeddedResource<EatWhitespace<Remainder>> extends [infer Fields, `${infer Remainder}`]
    ? // `field(nodes)`
      [{ name: Name; original: Name; children: Fields }, EatWhitespace<Remainder>]
    : ParseJsonAccessor<EatWhitespace<Remainder>> extends [
        infer PropertyName,
        infer PropertyType,
        `${infer Remainder}`
      ]
    ? // `field->json...`
      [{ name: PropertyName; type: PropertyType }, EatWhitespace<Remainder>]
    : ParseEmbeddedResource<EatWhitespace<Remainder>> extends ParserError<string>
    ? ParseEmbeddedResource<EatWhitespace<Remainder>>
    : // `field`
      [{ name: Name; original: Name }, EatWhitespace<Remainder>]
  : ParserError<`Expected identifier at \`${Input}\``>

/**
 * Parses a JSON property accessor of the shape `->a->b->c`. The last accessor in
 * the series may convert to text by using the ->> operator instead of ->.
 *
 * Returns a tuple of ["Last property name", "Last property type", "Remainder of text"]
 * or the original string input indicating that no opening `->` was found.
 */
type ParseJsonAccessor<Input extends string> = Input extends `->${infer Remainder}`
  ? Remainder extends `>${infer Remainder}`
    ? ParseIdentifier<Remainder> extends [infer Name, `${infer Remainder}`]
      ? [Name, string, EatWhitespace<Remainder>]
      : ParserError<'Expected property name after `->>`'>
    : ParseIdentifier<Remainder> extends [infer Name, `${infer Remainder}`]
    ? ParseJsonAccessor<Remainder> extends [
        infer PropertyName,
        infer PropertyType,
        `${infer Remainder}`
      ]
      ? [PropertyName, PropertyType, EatWhitespace<Remainder>]
      : [Name, Json, EatWhitespace<Remainder>]
    : ParserError<'Expected property name after `->`'>
  : Input

/**
 * Parses an embedded resource, which is an opening `(`, followed by a sequence of
 * nodes, separated by `,`, then a closing `)`.
 *
 * Returns a tuple of ["Parsed fields", "Remainder of text"], an error,
 * or the original string input indicating that no opening `(` was found.
 */
type ParseEmbeddedResource<Input extends string> = Input extends `(${infer Remainder}`
  ? ParseNodes<EatWhitespace<Remainder>> extends [infer Fields, `${infer Remainder}`]
    ? EatWhitespace<Remainder> extends `)${infer Remainder}`
      ? Fields extends []
        ? ParserError<'Expected fields after `(`'>
        : [Fields, EatWhitespace<Remainder>]
      : ParserError<`Expected ")"`>
    : ParseNodes<EatWhitespace<Remainder>>
  : Input

/**
 * Parses a sequence of nodes, separated by `,`.
 *
 * Returns a tuple of ["Parsed fields", "Remainder of text"] or an error.
 */
type ParseNodes<Input extends string> = string extends Input
  ? GenericStringError
  : ParseNodesHelper<Input, []>

type ParseNodesHelper<Input extends string, Fields extends unknown[]> = ParseNode<Input> extends [
  infer Field,
  `${infer Remainder}`
]
  ? EatWhitespace<Remainder> extends `,${infer Remainder}`
    ? ParseNodesHelper<EatWhitespace<Remainder>, [Field, ...Fields]>
    : [[Field, ...Fields], EatWhitespace<Remainder>]
  : ParseNode<Input>

/**
 * Parses a query.
 * A query is a sequence of nodes, separated by `,`, ensuring that there is
 * no remaining input after all nodes have been parsed.
 *
 * Returns an array of parsed nodes, or an error.
 */
type ParseQuery<Query extends string> = string extends Query
  ? GenericStringError
  : ParseNodes<EatWhitespace<Query>> extends [infer Fields, `${infer Remainder}`]
  ? EatWhitespace<Remainder> extends ''
    ? Fields
    : ParserError<`Unexpected input: ${Remainder}`>
  : ParseNodes<EatWhitespace<Query>>

type GetResultHelper<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName,
  Relationships,
  Fields extends unknown[],
  Acc
> = Fields extends [infer R]
  ? ConstructFieldDefinition<Schema, Row, RelationName, Relationships, R> extends SelectQueryError<
      infer E
    >
    ? SelectQueryError<E>
    : GetResultHelper<
        Schema,
        Row,
        RelationName,
        Relationships,
        [],
        ConstructFieldDefinition<Schema, Row, RelationName, Relationships, R> & Acc
      >
  : Fields extends [infer R, ...infer Rest]
  ? ConstructFieldDefinition<Schema, Row, RelationName, Relationships, R> extends SelectQueryError<
      infer E
    >
    ? SelectQueryError<E>
    : GetResultHelper<
        Schema,
        Row,
        RelationName,
        Relationships,
        Rest,
        ConstructFieldDefinition<Schema, Row, RelationName, Relationships, R> & Acc
      >
  : Prettify<Acc>

/**
 * Constructs a type definition for an object based on a given PostgREST query.
 *
 * @param Row Record<string, unknown>.
 * @param Query Select query string literal to parse.
 */
export type GetResult<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  RelationName,
  Relationships,
  Query extends string
> = ParseQuery<Query> extends unknown[]
  ? GetResultHelper<Schema, Row, RelationName, Relationships, ParseQuery<Query>, unknown>
  : ParseQuery<Query>
