// ---------------------------------------------------------------------------
// Case-conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary identifier to snake_case.
 * Handles camelCase, PascalCase, SCREAMING_SNAKE, kebab-case, and space-separated words.
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

/**
 * Convert an arbitrary identifier to SCREAMING_SNAKE_CASE.
 */
export function toScreamingSnakeCase(name: string): string {
  return toSnakeCase(name).toUpperCase()
}

/**
 * Convert an arbitrary identifier to PascalCase.
 */
export function toPascalCase(name: string): string {
  return toSnakeCase(name)
    .split('_')
    .map(word => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : ''))
    .join('')
}

/**
 * Convert an arbitrary identifier to camelCase.
 */
export function toCamelCase(name: string): string {
  const pascal = toPascalCase(name)
  return pascal.length > 0 ? pascal[0].toLowerCase() + pascal.slice(1) : ''
}

// ---------------------------------------------------------------------------
// Type-mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map a schema field type name to the appropriate C UAPI type.
 *
 * The Linux UAPI convention uses `__u8`, `__u16`, `__u32`, `__u64`,
 * `__s8`, `__s16`, `__s32`, `__s64`, `__be16`, `__be32`, `__be64` for
 * fixed-width types.  Any type that is not recognised is emitted as-is,
 * which is the correct behaviour for types defined elsewhere in the schema
 * (e.g. nested struct names or enum names).
 */
export function mapCType(fieldType: string): string {
  const normalised = fieldType.trim().toLowerCase()

  // Explicit UAPI type pass-through
  if (/^__(u|s|be|le)(8|16|32|64)$/.test(normalised)) return fieldType.trim()

  switch (normalised) {
    case 'u8':
    case 'uint8':
    case 'uint8_t':
    case 'byte':
      return '__u8'

    case 'u16':
    case 'uint16':
    case 'uint16_t':
      return '__u16'

    case 'u32':
    case 'uint32':
    case 'uint32_t':
    case 'uint':
    case 'unsigned':
    case 'unsigned int':
      return '__u32'

    case 'u64':
    case 'uint64':
    case 'uint64_t':
    case 'unsigned long long':
      return '__u64'

    case 's8':
    case 'int8':
    case 'int8_t':
      return '__s8'

    case 's16':
    case 'int16':
    case 'int16_t':
      return '__s16'

    case 's32':
    case 'int32':
    case 'int32_t':
    case 'int':
      return '__s32'

    case 's64':
    case 'int64':
    case 'int64_t':
    case 'long long':
      return '__s64'

    case 'be16':
      return '__be16'
    case 'be32':
      return '__be32'
    case 'be64':
      return '__be64'

    case 'le16':
      return '__le16'
    case 'le32':
      return '__le32'
    case 'le64':
      return '__le64'

    case 'string':
    case 'str':
    case 'char[]':
    case 'nulterm':
      return 'char *'

    case 'bool':
    case 'boolean':
      return '__u8'

    case 'flag':
    case 'flags':
      return '__u32'

    default:
      // Unknown type — return as-is.  Caller may be referencing another
      // named type from the same schema.
      return fieldType.trim()
  }
}

/**
 * Map a schema field type name to the appropriate TypeScript type.
 *
 * - 64-bit integers map to `bigint` (JavaScript cannot represent all u64 values
 *   in a `number` without precision loss).
 * - All other integer types map to `number`.
 * - String-like types map to `string`.
 * - Booleans map to `boolean`.
 * - Unknown types are PascalCase'd (they reference schema-defined types).
 */
export function mapTsType(fieldType: string): string {
  const normalised = fieldType.trim().toLowerCase()

  switch (normalised) {
    case 'u8':
    case 'uint8':
    case 'uint8_t':
    case '__u8':
    case 'byte':
    case 'u16':
    case 'uint16':
    case 'uint16_t':
    case '__u16':
    case '__be16':
    case '__le16':
    case 'u32':
    case 'uint32':
    case 'uint32_t':
    case '__u32':
    case '__be32':
    case '__le32':
    case 'uint':
    case 'unsigned':
    case 'unsigned int':
    case 's8':
    case 'int8':
    case 'int8_t':
    case '__s8':
    case 's16':
    case 'int16':
    case 'int16_t':
    case '__s16':
    case 's32':
    case 'int32':
    case 'int32_t':
    case '__s32':
    case 'int':
    case 'flag':
    case 'flags':
      return 'number'

    case 'u64':
    case 'uint64':
    case 'uint64_t':
    case '__u64':
    case '__be64':
    case '__le64':
    case 's64':
    case 'int64':
    case 'int64_t':
    case '__s64':
    case 'unsigned long long':
    case 'long long':
      return 'bigint'

    case 'string':
    case 'str':
    case 'char[]':
    case 'char *':
    case 'nulterm':
      return 'string'

    case 'bool':
    case 'boolean':
      return 'boolean'

    default:
      // Assume it references a schema-defined type; use its PascalCase name.
      return toPascalCase(fieldType.trim())
  }
}

// ---------------------------------------------------------------------------
// NLA (Netlink Attribute) type helpers
// ---------------------------------------------------------------------------

/**
 * Map a schema field type to the kernel NLA_* policy type constant.
 *
 * These constants are used in `nla_policy` arrays inside kernel module scaffolds.
 */
export function mapNlaType(fieldType: string): string {
  const normalised = fieldType.trim().toLowerCase()

  switch (normalised) {
    case 'u8':
    case 'uint8':
    case 'uint8_t':
    case '__u8':
    case 'byte':
      return 'NLA_U8'

    case 'u16':
    case 'uint16':
    case 'uint16_t':
    case '__u16':
    case '__be16':
    case '__le16':
      return 'NLA_U16'

    case 'u32':
    case 'uint32':
    case 'uint32_t':
    case '__u32':
    case '__be32':
    case '__le32':
    case 'uint':
    case 'unsigned':
    case 'unsigned int':
    case 'int':
    case 's32':
    case 'int32':
    case 'int32_t':
    case '__s32':
    case 'flag':
    case 'flags':
      return 'NLA_U32'

    case 'u64':
    case 'uint64':
    case 'uint64_t':
    case '__u64':
    case '__be64':
    case '__le64':
    case 's64':
    case 'int64':
    case 'int64_t':
    case '__s64':
    case 'unsigned long long':
    case 'long long':
      return 'NLA_U64'

    case 'string':
    case 'str':
    case 'nulterm':
    case 'char[]':
    case 'char *':
      return 'NLA_NUL_STRING'

    case 'bool':
    case 'boolean':
      return 'NLA_FLAG'

    default:
      return 'NLA_NESTED'
  }
}

// ---------------------------------------------------------------------------
// Escaping helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe use inside a C string literal (double-quoted).
 * Handles backslashes, double quotes, and control characters.
 */
export function escapeCString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Escape a string for safe use inside a Markdown table cell.
 * Replaces pipe characters and newlines.
 */
export function escapeMarkdownCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '')
}
