import { GeneratorInput, GeneratedArtifact, ArtifactType, Generator } from './types'
import { SchemaJsonGenerator } from './schema-json-generator'
import { MarkdownGenerator } from './markdown-generator'
import { CHeaderGenerator } from './c-header-generator'
import { TsClientGenerator } from './ts-client-generator'
import { KernelScaffoldGenerator } from './kernel-scaffold-generator'

const generators = new Map<ArtifactType, Generator>([
  ['SCHEMA_JSON', new SchemaJsonGenerator()],
  ['MARKDOWN_DOCS', new MarkdownGenerator()],
  ['C_UAPI_HEADER', new CHeaderGenerator()],
  ['TS_CLIENT', new TsClientGenerator()],
  ['KERNEL_SCAFFOLD', new KernelScaffoldGenerator()],
])

export function generateArtifacts(input: GeneratorInput): GeneratedArtifact[] {
  const results: GeneratedArtifact[] = []
  for (const target of input.targets) {
    const generator = generators.get(target)
    if (!generator) {
      results.push({
        filePath: `${target.toLowerCase()}.txt`,
        artifactType: target,
        content: `// Generator for ${target} is not yet implemented`,
        generatorVersion: input.generatorVersion,
        warnings: [`No generator available for artifact type: ${target}`],
      })
      continue
    }
    results.push(generator.generate(input))
  }
  return results
}

export function getAvailableGenerators(): ArtifactType[] {
  return Array.from(generators.keys())
}

export function generateAll(input: Omit<GeneratorInput, 'targets'>): GeneratedArtifact[] {
  return generateArtifacts({ ...input, targets: getAvailableGenerators() })
}
