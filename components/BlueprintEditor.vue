<template>
  <div class="blueprint-editor">
    <!-- Toolbar -->
    <div class="toolbar">
      <button class="toolbar-btn" @click="clearCanvas">
        <v-icon size="16">mdi-delete</v-icon>
        Clear
      </button>
      <button class="toolbar-btn" @click="saveBlueprint" title="Export blueprint as JSON file">
        <v-icon size="16">mdi-download</v-icon>
        Export
      </button>
      <button class="toolbar-btn" @click="loadBlueprint" title="Import blueprint from JSON file">
        <v-icon size="16">mdi-upload</v-icon>
        Import
      </button>
      <div class="toolbar-status" :title="`Last auto-save: ${lastSaved?.toLocaleString() || 'Never'}`">
        <v-icon size="14" color="success">mdi-cloud-check</v-icon>
        {{ lastSavedText }}
      </div>
    </div>

    <!-- Node Palette -->
    <NodePalette @node-drop="addNode" />

    <!-- Context Menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :position="contextMenu.position"
      :connection-id="contextMenu.connectionId"
      @delete-connection="deleteConnection"
      @highlight-connection="highlightConnection"
      @show-connection-info="showConnectionInfo"
      @close="closeContextMenu"
    />

    <!-- Canvas -->
    <div 
      ref="canvas"
      class="blueprint-canvas"
      @mousedown="onCanvasMouseDown"
      @mousemove="onCanvasMouseMove"
      @mouseup="onCanvasMouseUp"
      @drop="onCanvasDrop"
      @dragover.prevent
    >
      <!-- Connection SVG -->
      <svg class="connection-svg">
        <!-- Define gradients for flow animation -->
        <defs>
          <linearGradient
            v-for="connection in connections"
            :id="`flow-gradient-${connection.id}`"
            :key="`gradient-${connection.id}`"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" :stop-color="getConnectionColor(connection.type)" stop-opacity="0">
              <animate
                attributeName="offset"
                values="-0.2;1"
                :dur="getFlowSpeed(connection.type)"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="10%" :stop-color="getConnectionColor(connection.type)" stop-opacity="1">
              <animate
                attributeName="offset"
                values="-0.1;1.1"
                :dur="getFlowSpeed(connection.type)"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="20%" :stop-color="getConnectionColor(connection.type)" stop-opacity="0">
              <animate
                attributeName="offset"
                values="0;1.2"
                :dur="getFlowSpeed(connection.type)"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
        
        <!-- Connection paths -->
        <g v-for="connection in connections" :key="connection.id">
          <!-- Base connection line -->
          <path
            :data-connection-id="connection.id"
            :d="connection.path"
            :class="['connection-path', connection.type]"
            @contextmenu.prevent="onConnectionRightClick($event, connection.id)"
            @click="onConnectionClick(connection.id)"
          />
          <!-- Flow animation overlay -->
          <path
            :d="connection.path"
            :class="['connection-flow', connection.type]"
            :stroke="`url(#flow-gradient-${connection.id})`"
            stroke-width="2"
            fill="none"
            pointer-events="none"
          />
        </g>
        
        <!-- Temporary connection while dragging -->
        <path
          v-if="isDraggingConnection && dragConnectionPath"
          :d="dragConnectionPath"
          class="connection-path temp"
        />
      </svg>

      <!-- Nodes -->
      <BlueprintNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :selected="selectedNodes.includes(node.id)"
        @select="selectNode"
        @delete="deleteNode"
        @pin-drag-start="onPinDragStart"
        @pin-drag-end="onPinDragEnd"
        @update:position="updateNodePosition"
        @drag-start="onNodeDragStart"
        @drag-end="onNodeDragEnd"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'

interface Pin {
  id: string
  type: string
  name: string
  direction: 'input' | 'output'
}

interface Node {
  id: string
  type: string
  name: string
  x: number
  y: number
  pins: Pin[]
}

interface Connection {
  id: string
  from: { nodeId: string, pinId: string }
  to: { nodeId: string, pinId: string }
  type: string
  path: string
}

const canvas = ref<HTMLElement>()
const nodes = ref<Node[]>([])
const connections = ref<Connection[]>([])
const selectedNodes = ref<string[]>([])
const tempConnection = ref<string | null>(null)

// Canvas panning
const canvasOffset = reactive({ x: 0, y: 0 })
const isPanning = ref(false)
const lastPanPoint = reactive({ x: 0, y: 0 })

// Pin connection
const draggedPin = ref<{ nodeId: string, pinId: string, type: string, element: HTMLElement | null } | null>(null)
const isDraggingConnection = ref(false)
const dragConnectionPath = ref<string>('')
const mousePosition = ref({ x: 0, y: 0 })

// Context menu
const contextMenu = ref({
  visible: false,
  position: { x: 0, y: 0 },
  connectionId: null as string | null
})

// Node dragging state
const draggingNodes = ref<Set<string>>(new Set())
let connectionUpdateInterval: number | null = null

// Auto-save key for localStorage
const STORAGE_KEY = 'blueprint-editor-state'
const lastSaved = ref<Date | null>(null)

const lastSavedText = computed(() => {
  if (!lastSaved.value) return 'Not saved'
  const now = new Date()
  const diff = now.getTime() - lastSaved.value.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (seconds < 10) return 'Just saved'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  return `${hours}h ago`
})

const addNode = (nodeType: string, x: number, y: number) => {
  const nodeTemplates = {
    'if': {
      name: 'Branch',
      pins: [
        { id: 'exec-in', type: 'exec', name: '', direction: 'input' },
        { id: 'condition', type: 'bool', name: 'Condition', direction: 'input' },
        { id: 'true', type: 'exec', name: 'True', direction: 'output' },
        { id: 'false', type: 'exec', name: 'False', direction: 'output' },
      ]
    },
    'while': {
      name: 'While Loop',
      pins: [
        { id: 'exec-in', type: 'exec', name: '', direction: 'input' },
        { id: 'condition', type: 'bool', name: 'Condition', direction: 'input' },
        { id: 'loop-body', type: 'exec', name: 'Loop Body', direction: 'output' },
        { id: 'completed', type: 'exec', name: 'Completed', direction: 'output' },
      ]
    },
    'function': {
      name: 'Function Call',
      pins: [
        { id: 'exec-in', type: 'exec', name: '', direction: 'input' },
        { id: 'target', type: 'object', name: 'Target', direction: 'input' },
        { id: 'exec-out', type: 'exec', name: '', direction: 'output' },
        { id: 'return', type: 'object', name: 'Return Value', direction: 'output' },
      ]
    },
    'variable': {
      name: 'Get Variable',
      pins: [
        { id: 'value', type: 'object', name: 'Value', direction: 'output' },
      ]
    },
    'print': {
      name: 'Print String',
      pins: [
        { id: 'exec-in', type: 'exec', name: '', direction: 'input' },
        { id: 'string', type: 'string', name: 'In String', direction: 'input' },
        { id: 'exec-out', type: 'exec', name: '', direction: 'output' },
      ]
    },
    'event': {
      name: 'Event Begin Play',
      pins: [
        { id: 'exec-out', type: 'exec', name: '', direction: 'output' },
      ]
    },
    'add': {
      name: 'Add',
      pins: [
        { id: 'a', type: 'float', name: 'A', direction: 'input' },
        { id: 'b', type: 'float', name: 'B', direction: 'input' },
        { id: 'result', type: 'float', name: 'Result', direction: 'output' },
      ]
    },
    'multiply': {
      name: 'Multiply',
      pins: [
        { id: 'a', type: 'float', name: 'A', direction: 'input' },
        { id: 'b', type: 'float', name: 'B', direction: 'input' },
        { id: 'result', type: 'float', name: 'Result', direction: 'output' },
      ]
    },
    'compare': {
      name: 'Equal',
      pins: [
        { id: 'a', type: 'object', name: 'A', direction: 'input' },
        { id: 'b', type: 'object', name: 'B', direction: 'input' },
        { id: 'result', type: 'bool', name: 'Result', direction: 'output' },
      ]
    },
    'delay': {
      name: 'Delay',
      pins: [
        { id: 'exec-in', type: 'exec', name: '', direction: 'input' },
        { id: 'duration', type: 'float', name: 'Duration', direction: 'input' },
        { id: 'exec-out', type: 'exec', name: '', direction: 'output' },
      ]
    },
    'cast': {
      name: 'Cast',
      pins: [
        { id: 'object', type: 'object', name: 'Object', direction: 'input' },
        { id: 'result', type: 'object', name: 'As Object', direction: 'output' },
      ]
    }
  }

  const template = nodeTemplates[nodeType as keyof typeof nodeTemplates]
  if (!template) return

  const newNode: Node = {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: nodeType,
    name: template.name,
    x: x - canvasOffset.x,
    y: y - canvasOffset.y,
    pins: template.pins.map(pin => ({
      ...pin,
      id: `${pin.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }))
  }

  nodes.value.push(newNode)
  
  // Update connections after adding a node
  nextTick(() => {
    updateConnections()
    autoSave()
  })
}

const selectNode = (nodeId: string, multiSelect = false) => {
  if (multiSelect) {
    if (selectedNodes.value.includes(nodeId)) {
      selectedNodes.value = selectedNodes.value.filter(id => id !== nodeId)
    } else {
      selectedNodes.value.push(nodeId)
    }
  } else {
    selectedNodes.value = [nodeId]
  }
}

const deleteNode = (nodeId: string) => {
  nodes.value = nodes.value.filter(node => node.id !== nodeId)
  connections.value = connections.value.filter(
    conn => conn.from.nodeId !== nodeId && conn.to.nodeId !== nodeId
  )
  selectedNodes.value = selectedNodes.value.filter(id => id !== nodeId)
  autoSave()
}

const updateNodePosition = (nodeId: string, x: number, y: number) => {
  const node = nodes.value.find(n => n.id === nodeId)
  if (node) {
    node.x = x
    node.y = y
    
    // If node is being dragged, update connections immediately
    if (draggingNodes.value.has(nodeId)) {
      updateConnections()
    } else {
      // Otherwise, debounce the update
      updateConnections()
      clearTimeout(updateNodePosition.saveTimeout)
      updateNodePosition.saveTimeout = setTimeout(autoSave, 500)
    }
  }
}
updateNodePosition.saveTimeout = null as any

const onNodeDragStart = (nodeId: string) => {
  draggingNodes.value.add(nodeId)
  
  // Start real-time connection updates during dragging
  if (!connectionUpdateInterval) {
    connectionUpdateInterval = setInterval(() => {
      if (draggingNodes.value.size > 0) {
        updateConnections()
      }
    }, 16) // ~60fps updates
  }
}

const onNodeDragEnd = (nodeId: string) => {
  draggingNodes.value.delete(nodeId)
  
  // Stop real-time updates when no nodes are being dragged
  if (draggingNodes.value.size === 0 && connectionUpdateInterval) {
    clearInterval(connectionUpdateInterval)
    connectionUpdateInterval = null
    
    // Final update and save
    updateConnections()
    autoSave()
  }
}

const onCanvasMouseDown = (event: MouseEvent) => {
  // Close context menu if clicking elsewhere
  if (contextMenu.value.visible) {
    closeContextMenu()
  }
  
  // Don't start panning if we're dragging a connection
  if (isDraggingConnection.value) return
  
  if (event.target === canvas.value) {
    isPanning.value = true
    lastPanPoint.x = event.clientX
    lastPanPoint.y = event.clientY
    selectedNodes.value = []
  }
}

const onCanvasMouseMove = (event: MouseEvent) => {
  // Only handle canvas panning if we're not dragging a connection
  if (isPanning.value && !isDraggingConnection.value) {
    const deltaX = event.clientX - lastPanPoint.x
    const deltaY = event.clientY - lastPanPoint.y
    
    canvasOffset.x += deltaX
    canvasOffset.y += deltaY
    
    lastPanPoint.x = event.clientX
    lastPanPoint.y = event.clientY
    
    updateCanvasTransform()
  }
}

const onCanvasMouseUp = () => {
  isPanning.value = false
  // Clean up connection drag if user releases mouse over canvas
  if (isDraggingConnection.value) {
    isDraggingConnection.value = false
    dragConnectionPath.value = ''
    draggedPin.value = null
  }
}

const onCanvasDrop = (event: DragEvent) => {
  event.preventDefault()
  const nodeType = event.dataTransfer?.getData('text/plain')
  if (nodeType) {
    addNode(nodeType, event.clientX, event.clientY)
  }
}

const onPinDragStart = (nodeId: string, pinId: string, type: string, element: HTMLElement) => {
  draggedPin.value = { nodeId, pinId, type, element }
  isDraggingConnection.value = true
  console.log('Pin drag started:', { nodeId, pinId, type })
  
  // Update drag preview on mouse move
  const handleMouseMove = (e: MouseEvent) => {
    const canvasRect = canvas.value?.getBoundingClientRect()
    if (canvasRect) {
      mousePosition.value = { 
        x: e.clientX - canvasRect.left, 
        y: e.clientY - canvasRect.top 
      }
      updateDragConnectionPreview()
    }
  }
  
  const handleMouseUp = () => {
    isDraggingConnection.value = false
    dragConnectionPath.value = ''
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const onPinDragEnd = (nodeId: string, pinId: string, type: string, element: HTMLElement) => {
  console.log('Pin drag ended:', { nodeId, pinId, type })
  if (draggedPin.value && draggedPin.value.nodeId !== nodeId) {
    console.log('Creating connection between:', draggedPin.value, 'and', { nodeId, pinId, type })
    createConnection(draggedPin.value, { nodeId, pinId, type, element })
  }
  draggedPin.value = null
  isDraggingConnection.value = false
  dragConnectionPath.value = ''
}

const updateDragConnectionPreview = () => {
  if (!draggedPin.value || !isDraggingConnection.value) return
  
  const startPos = getPinPosition(draggedPin.value.element)
  if (startPos) {
    const endX = mousePosition.value.x
    const endY = mousePosition.value.y
    
    // Create bezier curve for preview
    const distance = Math.abs(endX - startPos.x)
    const controlOffset = Math.min(distance * 0.6, 150)
    const controlX1 = startPos.x + controlOffset
    const controlX2 = endX - controlOffset
    
    dragConnectionPath.value = `M ${startPos.x} ${startPos.y} C ${controlX1} ${startPos.y} ${controlX2} ${endY} ${endX} ${endY}`
    
    console.log('Drag preview path:', dragConnectionPath.value)
    console.log('Start pos:', startPos, 'End pos:', { x: endX, y: endY })
  }
}

const getPinPosition = (pinElement: HTMLElement | null) => {
  if (!pinElement) return null
  
  const rect = pinElement.getBoundingClientRect()
  const canvasRect = canvas.value?.getBoundingClientRect()
  
  if (!canvasRect) return null
  
  return {
    x: rect.left + rect.width / 2 - canvasRect.left,
    y: rect.top + rect.height / 2 - canvasRect.top
  }
}

const createConnection = (from: any, to: any) => {
  // Prevent connecting same types incorrectly
  const fromNode = nodes.value.find(n => n.id === from.nodeId)
  const toNode = nodes.value.find(n => n.id === to.nodeId)
  
  if (!fromNode || !toNode) return
  
  const fromPin = fromNode.pins.find(p => p.id === from.pinId)
  const toPin = toNode.pins.find(p => p.id === to.pinId)
  
  if (!fromPin || !toPin) return
  
  // Check if connection is valid - must be output to input
  if (fromPin.direction === toPin.direction) return
  
  // Ensure we connect output to input (swap if needed)
  let sourcePin = fromPin.direction === 'output' ? from : to
  let targetPin = fromPin.direction === 'output' ? to : from
  let sourcePinObj = fromPin.direction === 'output' ? fromPin : toPin
  let targetPinObj = fromPin.direction === 'output' ? toPin : fromPin
  
  // Type compatibility check
  if (sourcePinObj.type !== targetPinObj.type && sourcePinObj.type !== 'exec' && targetPinObj.type !== 'exec') return
  
  // Check if connection already exists between these pins
  const existingConnection = connections.value.find(conn => 
    (conn.from.nodeId === sourcePin.nodeId && conn.from.pinId === sourcePin.pinId &&
     conn.to.nodeId === targetPin.nodeId && conn.to.pinId === targetPin.pinId) ||
    (conn.from.nodeId === targetPin.nodeId && conn.from.pinId === targetPin.pinId &&
     conn.to.nodeId === sourcePin.nodeId && conn.to.pinId === sourcePin.pinId)
  )
  
  if (existingConnection) {
    console.log('Connection already exists between these pins')
    return
  }
  
  // For input pins, remove any existing connections (input pins can only have one connection)
  if (targetPinObj.direction === 'input' && targetPinObj.type !== 'exec') {
    connections.value = connections.value.filter(conn => 
      !(conn.to.nodeId === targetPin.nodeId && conn.to.pinId === targetPin.pinId)
    )
  }
  
  const connection: Connection = {
    id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: { nodeId: sourcePin.nodeId, pinId: sourcePin.pinId },
    to: { nodeId: targetPin.nodeId, pinId: targetPin.pinId },
    type: sourcePinObj.type,
    path: ''
  }
  
  connections.value.push(connection)
  updateConnections()
  autoSave()
}

const updateConnections = (useActualPins = true) => {
  connections.value.forEach(connection => {
    let connectionUpdated = false
    
    // Try to get actual pin positions from DOM elements (if requested and available)
    if (useActualPins) {
      const fromPinElement = document.querySelector(`[data-pin-id="${connection.from.pinId}"]`) as HTMLElement
      const toPinElement = document.querySelector(`[data-pin-id="${connection.to.pinId}"]`) as HTMLElement
      
      if (fromPinElement && toPinElement) {
        const fromPos = getPinPosition(fromPinElement)
        const toPos = getPinPosition(toPinElement)
        
        if (fromPos && toPos) {
          // Create smooth bezier curve between actual pin positions
          const distance = Math.abs(fromPos.x - toPos.x)
          const controlOffset = Math.min(distance * 0.6, 150)
          const fromControlX = fromPos.x + controlOffset
          const toControlX = toPos.x - controlOffset
          
          connection.path = `M ${fromPos.x} ${fromPos.y} C ${fromControlX} ${fromPos.y} ${toControlX} ${toPos.y} ${toPos.x} ${toPos.y}`
          connectionUpdated = true
        }
      }
    }
    
    // Fallback to calculated positions if DOM elements not found or not using actual pins
    if (!connectionUpdated) {
      const fromNode = nodes.value.find(n => n.id === connection.from.nodeId)
      const toNode = nodes.value.find(n => n.id === connection.to.nodeId)
      
      if (fromNode && toNode) {
        const fromPin = fromNode.pins.find(p => p.id === connection.from.pinId)
        const toPin = toNode.pins.find(p => p.id === connection.to.pinId)
        
        if (fromPin && toPin) {
          const fromOutputPins = fromNode.pins.filter(p => p.direction === 'output')
          const toInputPins = toNode.pins.filter(p => p.direction === 'input')
          
          const fromPinIndex = fromOutputPins.indexOf(fromPin)
          const toPinIndex = toInputPins.indexOf(toPin)
          
          const nodeHeaderHeight = 36
          const pinHeight = 32
          const nodeBodyPadding = 12
          const nodeWidth = 200
          
          // More precise positioning to match actual pin locations
          const fromX = fromNode.x + nodeWidth // Right edge where output pins are
          const fromY = fromNode.y + nodeHeaderHeight + nodeBodyPadding + (fromPinIndex * pinHeight) + 12
          
          const toX = toNode.x // Left edge where input pins are
          const toY = toNode.y + nodeHeaderHeight + nodeBodyPadding + (toPinIndex * pinHeight) + 12
          
          const distance = Math.abs(fromX - toX)
          const controlOffset = Math.min(distance * 0.6, 150)
          const fromControlX = fromX + controlOffset
          const toControlX = toX - controlOffset
          
          connection.path = `M ${fromX} ${fromY} C ${fromControlX} ${fromY} ${toControlX} ${toY} ${toX} ${toY}`
        }
      }
    }
  })
}

const updateCanvasTransform = () => {
  if (canvas.value) {
    canvas.value.style.transform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`
  }
}

const clearCanvas = () => {
  if (confirm('Are you sure you want to clear the entire canvas? This will delete all nodes and connections.')) {
    nodes.value = []
    connections.value = []
    selectedNodes.value = []
    canvasOffset.x = 0
    canvasOffset.y = 0
    updateCanvasTransform()
    autoSave()
  }
}

// Auto-save to localStorage
const autoSave = () => {
  const blueprint = {
    nodes: nodes.value,
    connections: connections.value,
    canvasOffset: canvasOffset,
    timestamp: Date.now()
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blueprint))
    lastSaved.value = new Date()
    console.log('Auto-saved blueprint to localStorage')
  } catch (error) {
    console.error('Failed to auto-save blueprint:', error)
  }
}

// Auto-load from localStorage
const autoLoad = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const blueprint = JSON.parse(saved)
      nodes.value = blueprint.nodes || []
      connections.value = blueprint.connections || []
      if (blueprint.canvasOffset) {
        canvasOffset.x = blueprint.canvasOffset.x
        canvasOffset.y = blueprint.canvasOffset.y
        updateCanvasTransform()
      }
      // Wait for DOM to be fully rendered before updating connections
      nextTick(() => {
        // Try multiple times with increasing delays to ensure pins are rendered
        const retryUpdateConnections = (attempt = 0) => {
          const maxAttempts = 5
          const delay = 50 + (attempt * 100) // 50ms, 150ms, 250ms, 350ms, 450ms
          
          setTimeout(() => {
            // Check if pin elements exist
            const hasPinElements = connections.value.length === 0 || 
              connections.value.some(conn => {
                const fromPin = document.querySelector(`[data-pin-id="${conn.from.pinId}"]`)
                const toPin = document.querySelector(`[data-pin-id="${conn.to.pinId}"]`)
                return fromPin && toPin
              })
            
            if (hasPinElements || attempt >= maxAttempts) {
              updateConnections()
              console.log(`Connections updated on attempt ${attempt + 1}`)
            } else if (attempt < maxAttempts) {
              retryUpdateConnections(attempt + 1)
            }
          }, delay)
        }
        
        retryUpdateConnections()
      })
      lastSaved.value = new Date(blueprint.timestamp)
      console.log('Auto-loaded blueprint from localStorage')
      return true
    }
  } catch (error) {
    console.error('Failed to auto-load blueprint:', error)
  }
  return false
}

const saveBlueprint = () => {
  const blueprint = {
    nodes: nodes.value,
    connections: connections.value,
    canvasOffset: canvasOffset,
    metadata: {
      name: 'My Blueprint',
      created: Date.now(),
      version: '1.0'
    }
  }
  
  // Create downloadable file
  const dataStr = JSON.stringify(blueprint, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `blueprint-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  console.log('Blueprint saved as file')
}

const loadBlueprint = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const blueprint = JSON.parse(e.target?.result as string)
          nodes.value = blueprint.nodes || []
          connections.value = blueprint.connections || []
          if (blueprint.canvasOffset) {
            canvasOffset.x = blueprint.canvasOffset.x
            canvasOffset.y = blueprint.canvasOffset.y
            updateCanvasTransform()
          }
                     // Wait for DOM to be fully rendered before updating connections
           nextTick(() => {
             // Try multiple times with increasing delays to ensure pins are rendered
             const retryUpdateConnections = (attempt = 0) => {
               const maxAttempts = 5
               const delay = 50 + (attempt * 100)
               
               setTimeout(() => {
                 // Check if pin elements exist
                 const hasPinElements = connections.value.length === 0 || 
                   connections.value.some(conn => {
                     const fromPin = document.querySelector(`[data-pin-id="${conn.from.pinId}"]`)
                     const toPin = document.querySelector(`[data-pin-id="${conn.to.pinId}"]`)
                     return fromPin && toPin
                   })
                 
                 if (hasPinElements || attempt >= maxAttempts) {
                   updateConnections()
                   console.log(`Connections updated on import, attempt ${attempt + 1}`)
                 } else if (attempt < maxAttempts) {
                   retryUpdateConnections(attempt + 1)
                 }
               }, delay)
             }
             
             retryUpdateConnections()
           })
           autoSave() // Save the loaded blueprint
           console.log('Blueprint loaded from file')
        } catch (error) {
          console.error('Failed to load blueprint:', error)
          alert('Failed to load blueprint file. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
  }
  
  input.click()
}

// Connection context menu handlers
const onConnectionRightClick = (event: MouseEvent, connectionId: string) => {
  event.stopPropagation()
  contextMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    connectionId
  }
  console.log('Right clicked connection:', connectionId)
}

const onConnectionClick = (connectionId: string) => {
  console.log('Clicked connection:', connectionId)
  // Could select the connection or show properties
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
  contextMenu.value.connectionId = null
}

const deleteConnection = (connectionId: string) => {
  connections.value = connections.value.filter(conn => conn.id !== connectionId)
  autoSave()
  console.log('Deleted connection:', connectionId)
}

const highlightConnection = (connectionId: string) => {
  // Temporarily highlight the connection by adding a class
  const connectionElement = document.querySelector(`[data-connection-id="${connectionId}"]`)
  if (connectionElement) {
    connectionElement.classList.add('connection-highlighted')
    setTimeout(() => {
      connectionElement.classList.remove('connection-highlighted')
    }, 2000)
  }
  console.log('Highlighted connection:', connectionId)
}

const showConnectionInfo = (connectionId: string) => {
  const connection = connections.value.find(conn => conn.id === connectionId)
  if (connection) {
    const fromNode = nodes.value.find(n => n.id === connection.from.nodeId)
    const toNode = nodes.value.find(n => n.id === connection.to.nodeId)
    const fromPin = fromNode?.pins.find(p => p.id === connection.from.pinId)
    const toPin = toNode?.pins.find(p => p.id === connection.to.pinId)
    
    const info = {
      connectionId,
      type: connection.type,
      from: {
        node: fromNode?.name,
        pin: fromPin?.name || 'Exec'
      },
      to: {
        node: toNode?.name,
        pin: toPin?.name || 'Exec'
      }
    }
    
    console.log('Connection Info:', info)
    // Could show this in a modal or tooltip
  }
}

// Force update all connections (utility function)
const forceUpdateConnections = () => {
  console.log('Force updating all connections...')
  nextTick(() => {
    setTimeout(() => {
      updateConnections()
      console.log('Force update completed')
    }, 100)
  })
}

// Get connection color based on type
const getConnectionColor = (type: string) => {
  const colors = {
    'exec': '#ffffff',
    'bool': '#dc2626',
    'int': '#059669',
    'float': '#0891b2',
    'string': '#7c3aed',
    'object': '#0078d4',
    'default': '#666666'
  }
  return colors[type as keyof typeof colors] || colors.default
}

// Get flow animation speed based on connection type
const getFlowSpeed = (type: string) => {
  if (type === 'exec') return '1s' // Faster for execution flow
  return '2s' // Slower for data connections
}

onMounted(() => {
  // Try to auto-load saved blueprint
  const loaded = autoLoad()
  
  if (!loaded) {
    // Add some sample nodes if nothing was loaded
    nextTick(() => {
      addNode('event', 100, 100)
      addNode('print', 400, 100)
      addNode('if', 100, 250)
    })
  }
  
  // Update the "time ago" display every 10 seconds
  setInterval(() => {
    // This will trigger the computed property to re-evaluate
    if (lastSaved.value) {
      // Force reactivity update by creating a new date with same time
      lastSaved.value = new Date(lastSaved.value.getTime())
    }
  }, 10000)
  
  // Expose utility functions to global scope for debugging
  if (typeof window !== 'undefined') {
    (window as any).blueprintEditor = {
      forceUpdateConnections,
      updateConnections,
      nodes: nodes.value,
      connections: connections.value
    }
  }
})

onUnmounted(() => {
  // Clean up connection update interval
  if (connectionUpdateInterval) {
    clearInterval(connectionUpdateInterval)
    connectionUpdateInterval = null
  }
})

// Auto-save when blueprint data changes
watch([nodes, connections], () => {
  // Debounce auto-save to avoid saving too frequently during rapid changes
  clearTimeout(watch.saveTimeout)
  watch.saveTimeout = setTimeout(autoSave, 1000)
}, { deep: true })
watch.saveTimeout = null as any
</script> 