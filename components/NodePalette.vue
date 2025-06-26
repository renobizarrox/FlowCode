<template>
  <div class="node-palette">
    <div class="palette-header">
      <v-icon size="20">mdi-view-grid-plus</v-icon>
      Node Palette
    </div>
    
    <div class="palette-section">
      <div 
        v-for="category in nodeCategories"
        :key="category.name"
        class="palette-category"
      >
        <div class="category-header">
          <v-icon size="16" class="mr-2">{{ category.icon }}</v-icon>
          {{ category.name }}
        </div>
        
        <div 
          v-for="node in category.nodes"
          :key="node.type"
          class="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, node.type)"
          @click="onNodeClick(node.type)"
        >
          <div 
            class="node-type-icon"
            :style="{ backgroundColor: getNodeColor(node.type) }"
          />
          <div class="node-info">
            <div class="node-name">{{ node.name }}</div>
            <div class="node-description">{{ node.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface NodeTemplate {
  type: string
  name: string
  description: string
}

interface NodeCategory {
  name: string
  icon: string
  nodes: NodeTemplate[]
}

const emit = defineEmits<{
  'node-drop': [nodeType: string, x: number, y: number]
}>()

const nodeCategories = ref<NodeCategory[]>([
  {
    name: 'Flow Control',
    icon: 'mdi-git-branch',
    nodes: [
      {
        type: 'if',
        name: 'Branch',
        description: 'Conditional execution based on boolean input'
      },
      {
        type: 'while',
        name: 'While Loop',
        description: 'Repeats execution while condition is true'
      }
    ]
  },
  {
    name: 'Events',
    icon: 'mdi-lightning-bolt',
    nodes: [
      {
        type: 'event',
        name: 'Begin Play',
        description: 'Triggers when the game starts'
      }
    ]
  },
  {
    name: 'Functions',
    icon: 'mdi-function',
    nodes: [
      {
        type: 'function',
        name: 'Function Call',
        description: 'Calls a custom or built-in function'
      },
      {
        type: 'print',
        name: 'Print String',
        description: 'Outputs text to console or screen'
      }
    ]
  },
  {
    name: 'Variables',
    icon: 'mdi-variable',
    nodes: [
      {
        type: 'variable',
        name: 'Get Variable',
        description: 'Retrieves the value of a variable'
      }
    ]
  },
  {
    name: 'Math',
    icon: 'mdi-calculator',
    nodes: [
      {
        type: 'add',
        name: 'Add',
        description: 'Adds two numbers together'
      },
      {
        type: 'multiply',
        name: 'Multiply',
        description: 'Multiplies two numbers'
      },
      {
        type: 'compare',
        name: 'Equal',
        description: 'Compares if two values are equal'
      }
    ]
  },
  {
    name: 'Utilities',
    icon: 'mdi-wrench',
    nodes: [
      {
        type: 'delay',
        name: 'Delay',
        description: 'Waits for specified duration'
      },
      {
        type: 'cast',
        name: 'Cast',
        description: 'Converts between data types'
      }
    ]
  }
])

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

const onDragStart = (event: DragEvent, nodeType: string) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', nodeType)
    event.dataTransfer.effectAllowed = 'copy'
  }
}

const onNodeClick = (nodeType: string) => {
  // Add node at a default position when clicked
  emit('node-drop', nodeType, 300, 200)
}
</script>

<style scoped>
.node-type-icon {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-primary);
}

.node-description {
  font-size: 10px;
  line-height: 1.2;
  color: var(--text-muted);
  margin-top: 2px;
}

.palette-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  margin: 2px 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s ease;
}

.palette-item:hover {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  transform: translateX(2px);
}

.palette-item:active {
  cursor: grabbing;
}

.category-header {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-blue);
  margin-bottom: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border-color);
}
</style> 