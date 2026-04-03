import type { NodeTypes } from '@xyflow/react'

export { ApiRootNode } from './api-root-node'
export { TransportNode } from './transport-node'
export { CommandNode } from './command-node'
export { EventNode } from './event-node'
export { StructNode } from './struct-node'
export { EnumNode } from './enum-node'
export { PermissionNode } from './permission-node'
export { WarningNode } from './warning-node'

import { ApiRootNode } from './api-root-node'
import { TransportNode } from './transport-node'
import { CommandNode } from './command-node'
import { EventNode } from './event-node'
import { StructNode } from './struct-node'
import { EnumNode } from './enum-node'
import { PermissionNode } from './permission-node'
import { WarningNode } from './warning-node'

export const nodeTypes: NodeTypes = {
  apiRoot:    ApiRootNode,
  transport:  TransportNode,
  command:    CommandNode,
  event:      EventNode,
  struct:     StructNode,
  enum:       EnumNode,
  permission: PermissionNode,
  warning:    WarningNode,
} as NodeTypes
