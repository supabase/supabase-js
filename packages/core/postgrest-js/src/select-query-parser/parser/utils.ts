// Some utils type for the ParseQuery parser logic
// Count is a special case where an aggregate function won't need a column to be run against
// see: https://postgrest.org/en/v12/references/api/aggregate_functions.html#the-case-of-count

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

/**
 * Reads a consecutive sequence of 1 or more letters, where letters are `[0-9a-zA-Z_]`.
 */
export type ReadLetters<Input extends string> = string extends Input
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
 * Reads a consecutive sequence of 1 or more double-quoted letters,
 * where letters are `[^"]`.
 */
export type ReadQuotedLetters<Input extends string> = string extends Input
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
 * Parser errors.
 */
export type ParserError<Message extends string> = { error: true } & Message
export type GenericStringError = ParserError<'Received a generic string'>

/**
 * Creates a new {@link ParserError} if the given input is not already a parser error.
 */
export type CreateParserErrorIfRequired<
  Input,
  Message extends string
> = Input extends ParserError<string> ? Input : ParserError<Message>

type Whitespace = ' ' | '\n' | '\t'

/**
 * Trims whitespace from the left of the input.
 */
export type EatWhitespace<Input extends string> = string extends Input
  ? GenericStringError
  : Input extends `${Whitespace}${infer Remainder}`
  ? EatWhitespace<Remainder>
  : Input
