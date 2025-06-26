<template>
  <div 
    :class="['blueprint-node', { selected }]"
    :style="{ left: node.x + 'px', top: node.y + 'px' }"
    @mousedown="onMouseDown"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- Node Header -->
    <div class="node-header">
      <div 
        :class="['node-icon', node.type]"
        :style="{ backgroundColor: getNodeColor(node.type) }"
      />
      <span>{{ node.name }}</span>
      <v-btn
        size="x-small"
        icon
        variant="text"
        class="ml-auto"
        @click.stop="$emit('delete', node.id)"
      >
        <v-icon size="12">mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- Node Body -->
    <div class="node-body">
      <!-- Input Pins -->
      <div class="pins-section">
        <div 
          v-for="pin in inputPins"
          :key="pin.id"
          class="node-pin"
        >
          <div 
            :ref="`pin-${pin.id}`"
            :data-pin-id="pin.id"
            :class="['pin-connector', pin.type, 'pin-input']"
            @mousedown.stop="onPinMouseDown(pin, $event)"
            @mouseup.stop="onPinMouseUp(pin, $event)"
          />
          <span v-if="pin.name" class="pin-label">{{ pin.name }}</span>
          <input 
            v-if="pin.type !== 'exec' && pin.direction === 'input'"
            type="text"
            :placeholder="getPlaceholder(pin.type)"
            class="pin-input-field"
          />
        </div>
      </div>

      <!-- Output Pins -->
      <div class="pins-section">
        <div 
          v-for="pin in outputPins"
          :key="pin.id"
          class="node-pin output"
        >
          <span v-if="pin.name" class="pin-label">{{ pin.name }}</span>
          <div 
            :ref="`pin-${pin.id}`"
            :data-pin-id="pin.id"
            :class="['pin-connector', pin.type, 'pin-output']"
            @mousedown.stop="onPinMouseDown(pin, $event)"
            @mouseup.stop="onPinMouseUp(pin, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

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

interface Props {
  node: Node
  selected: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [nodeId: string, multiSelect?: boolean]
  delete: [nodeId: string]
  'pin-drag-start': [nodeId: string, pinId: string, type: string, element: HTMLElement]
  'pin-drag-end': [nodeId: string, pinId: string, type: string, element: HTMLElement]
  'update:position': [nodeId: string, x: number, y: number]
  'drag-start': [nodeId: string]
  'drag-end': [nodeId: string]
}>()

const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const inputPins = computed(() => 
  props.node.pins.filter(pin => pin.direction === 'input')
)

const outputPins = computed(() => 
  props.node.pins.filter(pin => pin.direction === 'output')
)

const getNodeColor = (type: string) => {
  const colors = {
    'if': '#ff8800',
    'while': '#ff8800',
    'function': '#0078d4',
    'variable': '#10ff10',
    'print': '#aa44ff',
    'event': '#ff4444',
    'add': '#059669',
    'multiply': '#059669',
    'compare': '#b91c1c',
    'delay': '#7c3aed',
    'cast': '#0891b2',
    'default': '#666666'
  }
  return colors[type as keyof typeof colors] || colors.default
}

const getPlaceholder = (type: string) => {
  const placeholders = {
    'bool': 'true/false',
    'int': '0',
    'float': '0.0',
    'string': 'text',
    'object': 'object'
  }
  return placeholders[type as keyof typeof placeholders] || 'value'
}

const onMouseDown = (event: MouseEvent) => {
  if (event.button === 0) { // Left click
    emit('select', props.node.id, event.ctrlKey || event.metaKey)
    
    isDragging.value = true
    dragOffset.value = {
      x: event.clientX - props.node.x,
      y: event.clientY - props.node.y
    }

    // Emit drag start event
    emit('drag-start', props.node.id)

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.value) {
        const newX = e.clientX - dragOffset.value.x
        const newY = e.clientY - dragOffset.value.y
        emit('update:position', props.node.id, newX, newY)
      }
    }

    const onMouseUp = () => {
      isDragging.value = false
      // Emit drag end event
      emit('drag-end', props.node.id)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

const onContextMenu = (event: MouseEvent) => {
  // Could show context menu here
  console.log('Context menu for node:', props.node.id)
}

const onPinMouseDown = (pin: Pin, event: MouseEvent) => {
  const element = event.target as HTMLElement
  emit('pin-drag-start', props.node.id, pin.id, pin.type, element)
}

const onPinMouseUp = (pin: Pin, event: MouseEvent) => {
  const element = event.target as HTMLElement
  emit('pin-drag-end', props.node.id, pin.id, pin.type, element)
}
</script>

<style scoped>
.pins-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 24px;
}

.node-pin.output {
  justify-content: flex-end;
}

.pin-input-field {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 11px;
  padding: 2px 6px;
  width: 80px;
  margin-left: 8px;
}

.pin-input-field:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.pin-input-field::placeholder {
  color: var(--text-muted);
}
</style> 