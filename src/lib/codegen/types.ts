export type ArtifactType =
  | 'SCHEMA_JSON'
  | 'SCHEMA_YAML'
  | 'MARKDOWN_DOCS'
  | 'TS_CLIENT'
  | 'C_UAPI_HEADER'
  | 'KERNEL_SCAFFOLD'
  | 'EXAMPLE_CLI'
  | 'TEST_SCAFFOLD'
  | 'VALIDATION_REPORT'
  | 'DIFF_SUMMARY'

export interface GeneratedArtifact {
  filePath: string
  artifactType: ArtifactType
  content: string
  generatorVersion: string
  warnings: string[]
}

export interface GeneratorInput {
  schema: {
    id: string
    version: number
    transport: string
    namespace: string
    family: string
    summary: string
    commands: Array<{
      name: string
      description: string
      requestType: {
        name: string
        fields: Array<{
          name: string
          fieldType: string
          optional: boolean
          reserved: boolean
          description: string
        }>
      } | null
      responseType: {
        name: string
        fields: Array<{
          name: string
          fieldType: string
          optional: boolean
          reserved: boolean
          description: string
        }>
      } | null
      interactionStyle: string
      privilegeRequirement: string | null
      idempotent: boolean
      deprecated: boolean
    }>
    events: Array<{
      name: string
      description: string
      payloadType: {
        name: string
        fields: Array<{
          name: string
          fieldType: string
          optional: boolean
        }>
      } | null
      subscriptionModel: string
    }>
    typeDefs: Array<{
      name: string
      kind: string
      description: string
      fields: Array<{
        name: string
        fieldType: string
        optional: boolean
        reserved: boolean
        description: string
      }>
      variants: Array<{
        name: string
        value: number
        description: string
      }>
    }>
    permissions: Array<{
      capability: string
      description: string
      namespaceAware: boolean
    }>
  }
  targets: ArtifactType[]
  generatorVersion: string
}

export interface Generator {
  type: ArtifactType
  generate(input: GeneratorInput): GeneratedArtifact
}
