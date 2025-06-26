<template>
  <div
    v-if="visible"
    class="context-menu"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @click.stop
  >
    <div class="context-menu-item" @click="onDeleteConnection">
      <v-icon size="16">mdi-delete</v-icon>
      Delete Connection
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" @click="onHighlightConnection">
      <v-icon size="16">mdi-eye</v-icon>
      Highlight Path
    </div>
    <div class="context-menu-item" @click="onShowConnectionInfo">
      <v-icon size="16">mdi-information</v-icon>
      Connection Info
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  visible: boolean
  position: { x: number, y: number }
  connectionId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'delete-connection': [connectionId: string]
  'highlight-connection': [connectionId: string]
  'show-connection-info': [connectionId: string]
  'close': []
}>()

const onDeleteConnection = () => {
  if (props.connectionId) {
    emit('delete-connection', props.connectionId)
  }
  emit('close')
}

const onHighlightConnection = () => {
  if (props.connectionId) {
    emit('highlight-connection', props.connectionId)
  }
  emit('close')
}

const onShowConnectionInfo = () => {
  if (props.connectionId) {
    emit('show-connection-info', props.connectionId)
  }
  emit('close')
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 2000;
  min-width: 180px;
  padding: 4px 0;
  user-select: none;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.context-menu-item:hover {
  background: var(--bg-tertiary);
}

.context-menu-item:active {
  background: var(--accent-blue);
}

.context-menu-separator {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}
</style> 