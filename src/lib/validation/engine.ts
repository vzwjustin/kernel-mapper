import { SchemaValidator } from './schema-validator'
import { AbiValidator } from './abi-validator'
import { WiringValidator } from './wiring-validator'
import { SecurityValidator } from './security-validator'
import { QualityValidator } from './quality-validator'
import type {
  SchemaForValidation,
  ValidationReport,
  ValidationFinding,
  ValidationGroup,
  Validator,
} from './types'

// ---------------------------------------------------------------------------
// Validator registry — order determines finding order in reports.
// ---------------------------------------------------------------------------

const ALL_VALIDATORS: Validator[] = [
  new SchemaValidator(),
  new AbiValidator(),
  new WiringValidator(),
  new SecurityValidator(),
  new QualityValidator(),
]

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSummary(findings: ValidationFinding[]): ValidationReport['summary'] {
  const byGroup: Record<ValidationGroup, number> = {
    SCHEMA_VALIDITY: 0,
    ABI_SAFETY: 0,
    WIRING_COMPLETENESS: 0,
    SECURITY: 0,
    DEVELOPER_QUALITY: 0,
  }

  let errors = 0
  let warnings = 0
  let infos = 0

  for (const f of findings) {
    byGroup[f.group]++
    if (f.severity === 'ERROR') errors++
    else if (f.severity === 'WARNING') warnings++
    else infos++
  }

  return { errors, warnings, infos, byGroup }
}

function runValidators(
  schema: SchemaForValidation,
  validators: Validator[],
): ValidationFinding[] {
  const findings: ValidationFinding[] = []
  for (const validator of validators) {
    try {
      findings.push(...validator.validate(schema))
    } catch {
      // A validator crashing must not prevent the others from running.
      // The failing validator's group simply contributes no findings.
    }
  }
  return findings
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all validators against the given schema and return a complete report.
 *
 * `passed` is true only when there are zero ERROR-severity findings.
 * Warnings and infos do not cause a failure.
 */
export function validateSchema(schema: SchemaForValidation): ValidationReport {
  const findings = runValidators(schema, ALL_VALIDATORS)
  const summary = buildSummary(findings)
  return {
    schemaId: schema.id,
    timestamp: new Date().toISOString(),
    findings,
    summary,
    passed: summary.errors === 0,
  }
}

/**
 * Run only the validators that belong to the specified groups.
 *
 * Useful for partial validation (e.g. running only SCHEMA_VALIDITY and
 * SECURITY in a CI gate while deferring DEVELOPER_QUALITY to a lint step).
 */
export function validateSchemaGroups(
  schema: SchemaForValidation,
  groups: ValidationGroup[],
): ValidationReport {
  const groupSet = new Set(groups)
  const validators = ALL_VALIDATORS.filter(v => groupSet.has(v.group))
  const findings = runValidators(schema, validators)
  const summary = buildSummary(findings)
  return {
    schemaId: schema.id,
    timestamp: new Date().toISOString(),
    findings,
    summary,
    passed: summary.errors === 0,
  }
}

/**
 * Convenience wrapper: returns true if the schema passes all validators
 * (zero ERROR-severity findings).
 */
export function isSchemaValid(schema: SchemaForValidation): boolean {
  return validateSchema(schema).passed
}

// Re-export validators for consumers that need to reference them directly.
export {
  SchemaValidator,
  AbiValidator,
  WiringValidator,
  SecurityValidator,
  QualityValidator,
}

// Re-export types so consumers can import everything from this single module.
export type {
  SchemaForValidation,
  ValidationReport,
  ValidationFinding,
  ValidationGroup,
  Validator,
}
