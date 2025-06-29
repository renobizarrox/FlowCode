<template>
  <div class="code-editor-container">
    <div class="editor-header">
      <div class="editor-title">
        <v-icon size="16">mdi-code-braces</v-icon>
        Code View
        <div v-if="isParsing" class="parsing-indicator">
          <v-icon size="12" class="spinning">mdi-loading</v-icon>
          Parsing...
        </div>
      </div>
      <div class="editor-actions">
        <button class="editor-btn" @click="copyCode" title="Copy code to clipboard">
          <v-icon size="16">mdi-content-copy</v-icon>
        </button>
        <button class="editor-btn" @click="formatCode" title="Format code">
          <v-icon size="16">mdi-format-align-left</v-icon>
        </button>
        <button class="editor-btn" @click="manualParseCode" title="Parse code to blueprint">
          <v-icon size="16">mdi-arrow-left</v-icon>
          Parse
        </button>
        <button class="editor-btn" @click="toggleHighlighting" :class="{ active: showHighlighting }" title="Toggle syntax highlighting">
          <v-icon size="16">mdi-palette</v-icon>
        </button>
        <select v-model="selectedLanguage" class="language-selector">
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="c">C++</option>
        </select>
      </div>
    </div>
    <div class="editor-content">
      <div class="line-numbers">
        <div v-for="(line, index) in lineNumbers" :key="index" class="line-number">
          {{ line }}
        </div>
      </div>
      <div class="code-editor-wrapper">
        <textarea
          ref="codeArea"
          v-model="code"
          class="code-textarea"
          @input="onCodeChange"
          @scroll="syncLineNumbers"
          @keydown="onKeyDown"
          spellcheck="false"
          placeholder="Type your code here..."
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

interface BlueprintNode {
  id: string
  type: string
  name: string
  x: number
  y: number
  pins: any[]
}

interface BlueprintConnection {
  id: string
  from: { nodeId: string, pinId: string }
  to: { nodeId: string, pinId: string }
  type: string
}

const props = defineProps<{
  nodes: BlueprintNode[]
  connections: BlueprintConnection[]
}>()

const emit = defineEmits<{
  'update:code': [code: string]
  'parse-code': [parsedData: { nodes: BlueprintNode[], connections: BlueprintConnection[] }]
}>()

const code = ref('')
const selectedLanguage = ref('javascript')
const codeArea = ref<HTMLTextAreaElement>()
const isParsing = ref(false)
const showHighlighting = ref(false)

// PrismJS will be loaded on client side
let Prism: any = null

const lineNumbers = computed(() => {
  const lines = code.value.split('\n').length
  return Array.from({ length: lines }, (_, i) => i + 1)
})

const highlightedCode = computed(() => {
  if (!code.value || !Prism || !showHighlighting.value) return ''
  try {
    const language = Prism.languages[selectedLanguage.value]
    if (!language) return code.value
    return Prism.highlight(code.value, language, selectedLanguage.value)
  } catch (error) {
    console.error('Syntax highlighting error:', error)
    return code.value
  }
})

// Convert blueprint to code
const blueprintToCode = () => {
  if (props.nodes.length === 0) {
    code.value = '// No nodes in blueprint'
    return
  }

  const codeLines: string[] = []
  const processedNodes = new Set<string>()
  
  // Find entry points (nodes with no incoming execution connections)
  const entryNodes = props.nodes.filter(node => {
    const hasIncomingExec = props.connections.some(conn => 
      conn.to.nodeId === node.id && conn.type === 'exec'
    )
    return !hasIncomingExec && node.pins.some(pin => pin.type === 'exec' && pin.direction === 'output')
  })

  // Process nodes starting from entry points
  const processNode = (node: BlueprintNode, indent = 0) => {
    if (processedNodes.has(node.id)) return
    processedNodes.add(node.id)

    const indentStr = '  '.repeat(indent)

    switch (node.type) {
      case 'event':
        if (selectedLanguage.value === 'javascript') {
          codeLines.push(`${indentStr}function onBeginPlay() {`)
        } else if (selectedLanguage.value === 'python') {
          codeLines.push(`${indentStr}def on_begin_play():`)
        } else if (selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}void BeginPlay() {`)
        }
        break

      case 'print':
        const stringInput = getInputValue(node, 'string')
        if (selectedLanguage.value === 'javascript') {
          codeLines.push(`${indentStr}console.log(${stringInput || '""'});`)
        } else if (selectedLanguage.value === 'python') {
          codeLines.push(`${indentStr}print(${stringInput || '""'})`)
        } else if (selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}std::cout << ${stringInput || '""'} << std::endl;`)
        }
        break

      case 'if':
        const condition = getInputValue(node, 'condition')
        if (selectedLanguage.value === 'javascript') {
          codeLines.push(`${indentStr}if (${condition || 'true'}) {`)
        } else if (selectedLanguage.value === 'python') {
          codeLines.push(`${indentStr}if ${condition || 'True'}:`)
        } else if (selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}if (${condition || 'true'}) {`)
        }
        
        // Process true branch
        const trueBranch = getConnectedNode(node, 'true')
        if (trueBranch) {
          processNode(trueBranch, indent + 1)
        }
        
        if (selectedLanguage.value === 'javascript' || selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}} else {`)
        } else {
          codeLines.push(`${indentStr}else:`)
        }
        
        // Process false branch
        const falseBranch = getConnectedNode(node, 'false')
        if (falseBranch) {
          processNode(falseBranch, indent + 1)
        }
        
        if (selectedLanguage.value === 'javascript' || selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}}`)
        }
        break

      case 'while':
        const loopCondition = getInputValue(node, 'condition')
        if (selectedLanguage.value === 'javascript') {
          codeLines.push(`${indentStr}while (${loopCondition || 'true'}) {`)
        } else if (selectedLanguage.value === 'python') {
          codeLines.push(`${indentStr}while ${loopCondition || 'True'}:`)
        } else if (selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}while (${loopCondition || 'true'}) {`)
        }
        
        // Process loop body
        const loopBody = getConnectedNode(node, 'loop-body')
        if (loopBody) {
          processNode(loopBody, indent + 1)
        }
        
        if (selectedLanguage.value === 'javascript' || selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}}`)
        }
        break

      case 'function':
        if (selectedLanguage.value === 'javascript') {
          codeLines.push(`${indentStr}functionCall();`)
        } else if (selectedLanguage.value === 'python') {
          codeLines.push(`${indentStr}function_call()`)
        } else if (selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}FunctionCall();`)
        }
        break

      case 'add':
        const addA = getInputValue(node, 'a') || '0'
        const addB = getInputValue(node, 'b') || '0'
        const addResult = `${addA} + ${addB}`
        codeLines.push(`${indentStr}// Result: ${addResult}`)
        break

      case 'multiply':
        const mulA = getInputValue(node, 'a') || '1'
        const mulB = getInputValue(node, 'b') || '1'
        const mulResult = `${mulA} * ${mulB}`
        codeLines.push(`${indentStr}// Result: ${mulResult}`)
        break

      case 'variable':
        codeLines.push(`${indentStr}// Get variable`)
        break

      case 'delay':
        const duration = getInputValue(node, 'duration') || '1.0'
        if (selectedLanguage.value === 'javascript') {
          codeLines.push(`${indentStr}await delay(${duration});`)
        } else if (selectedLanguage.value === 'python') {
          codeLines.push(`${indentStr}time.sleep(${duration})`)
        } else if (selectedLanguage.value === 'c') {
          codeLines.push(`${indentStr}FPlatformProcess::Sleep(${duration});`)
        }
        break
    }

    // Process next execution node
    const nextNode = getNextExecutionNode(node)
    if (nextNode && !processedNodes.has(nextNode.id)) {
      processNode(nextNode, indent)
    }
  }

  // Process all entry nodes
  entryNodes.forEach(node => processNode(node))

  // Close function blocks for event nodes
  if (entryNodes.some(n => n.type === 'event')) {
    if (selectedLanguage.value === 'javascript' || selectedLanguage.value === 'c') {
      codeLines.push('}')
    }
  }

  code.value = codeLines.join('\n')
}

// Helper functions
const getInputValue = (node: BlueprintNode, pinName: string): string | null => {
  const pin = node.pins.find(p => p.name === pinName || p.id.startsWith(pinName))
  if (!pin) return null
  
  // For now, return a placeholder. In a real implementation, 
  // this would look up the actual value from connected nodes
  return `"value"` 
}

const getConnectedNode = (node: BlueprintNode, pinName: string): BlueprintNode | null => {
  const pin = node.pins.find(p => p.name === pinName || p.id.startsWith(pinName))
  if (!pin) return null
  
  const connection = props.connections.find(conn => 
    conn.from.nodeId === node.id && conn.from.pinId === pin.id
  )
  
  if (!connection) return null
  
  return props.nodes.find(n => n.id === connection.to.nodeId) || null
}

const getNextExecutionNode = (node: BlueprintNode): BlueprintNode | null => {
  const execOutPin = node.pins.find(p => 
    p.type === 'exec' && p.direction === 'output' && p.name === ''
  )
  
  if (!execOutPin) return null
  
  const connection = props.connections.find(conn => 
    conn.from.nodeId === node.id && conn.from.pinId === execOutPin.id
  )
  
  if (!connection) return null
  
  return props.nodes.find(n => n.id === connection.to.nodeId) || null
}

// Event handlers
const onCodeChange = () => {
  emit('update:code', code.value)
  syncLineNumbers()
  
  // Parse code and update blueprint after a short delay
  clearTimeout(onCodeChange.parseTimeout)
  onCodeChange.parseTimeout = setTimeout(() => {
    parseCodeToBlueprint()
  }, 1000) // Wait 1 second after user stops typing
}
onCodeChange.parseTimeout = null as any

// Parse code and update blueprint
const parseCodeToBlueprint = () => {
  if (!code.value.trim()) return
  
  isParsing.value = true
  
  const newNodes: BlueprintNode[] = []
  const newConnections: BlueprintConnection[] = []
  
  try {
    const lines = code.value.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    let currentX = 100
    let currentY = 100
    let lastNode: BlueprintNode | null = null
    let insideFunction = false
    let insideIf = false
    let insideWhile = false
    let indentLevel = 0
    
    // Create entry node for functions
    if (selectedLanguage.value === 'javascript' && lines.some(line => line.includes('function'))) {
      const eventNode = createNode('event', 'Event Begin Play', currentX, currentY)
      newNodes.push(eventNode)
      lastNode = eventNode
      currentY += 100
    } else if (selectedLanguage.value === 'python' && lines.some(line => line.includes('def '))) {
      const eventNode = createNode('event', 'Event Begin Play', currentX, currentY)
      newNodes.push(eventNode)
      lastNode = eventNode
      currentY += 100
    } else if (selectedLanguage.value === 'c' && lines.some(line => line.includes('void'))) {
      const eventNode = createNode('event', 'Event Begin Play', currentX, currentY)
      newNodes.push(eventNode)
      lastNode = eventNode
      currentY += 100
    }
    
    for (const line of lines) {
      const currentIndent = getIndentLevel(line)
      
      // Handle function declarations
      if (line.includes('function ') || line.includes('def ') || line.includes('void ')) {
        insideFunction = true
        continue
      }
      
      // Handle closing braces/end of blocks
      if (line === '}' || currentIndent < indentLevel) {
        indentLevel = currentIndent
        if (insideIf || insideWhile) {
          insideIf = false
          insideWhile = false
        }
        continue
      }
      
      indentLevel = currentIndent
      
      // Parse different types of statements
      if (line.includes('console.log') || line.includes('print(') || line.includes('std::cout')) {
        const printNode = createNode('print', 'Print String', currentX, currentY)
        newNodes.push(printNode)
        
        if (lastNode) {
          const connection = createConnection(lastNode, printNode, 'exec')
          if (connection) newConnections.push(connection)
        }
        lastNode = printNode
        currentY += 100
      }
      
      else if (line.includes('if ') || line.includes('if(')) {
        const ifNode = createNode('if', 'Branch', currentX, currentY)
        newNodes.push(ifNode)
        
        if (lastNode) {
          const connection = createConnection(lastNode, ifNode, 'exec')
          if (connection) newConnections.push(connection)
        }
        lastNode = ifNode
        insideIf = true
        currentY += 100
      }
      
      else if (line.includes('while ') || line.includes('while(')) {
        const whileNode = createNode('while', 'While Loop', currentX, currentY)
        newNodes.push(whileNode)
        
        if (lastNode) {
          const connection = createConnection(lastNode, whileNode, 'exec')
          if (connection) newConnections.push(connection)
        }
        lastNode = whileNode
        insideWhile = true
        currentY += 100
      }
      
      else if (line.includes('delay(') || line.includes('sleep(') || line.includes('Sleep(')) {
        const delayNode = createNode('delay', 'Delay', currentX, currentY)
        newNodes.push(delayNode)
        
        if (lastNode) {
          const connection = createConnection(lastNode, delayNode, 'exec')
          if (connection) newConnections.push(connection)
        }
        lastNode = delayNode
        currentY += 100
      }
      
      else if (line.includes('+') && !line.includes('++')) {
        const addNode = createNode('add', 'Add', currentX, currentY)
        newNodes.push(addNode)
        lastNode = addNode
        currentY += 100
      }
      
      else if (line.includes('*') && !line.includes('/*')) {
        const multiplyNode = createNode('multiply', 'Multiply', currentX, currentY)
        newNodes.push(multiplyNode)
        lastNode = multiplyNode
        currentY += 100
      }
      
      // Handle function calls
      else if (line.includes('()') && !line.includes('if') && !line.includes('while') && !line.includes('function')) {
        const functionNode = createNode('function', 'Function Call', currentX, currentY)
        newNodes.push(functionNode)
        
        if (lastNode) {
          const connection = createConnection(lastNode, functionNode, 'exec')
          if (connection) newConnections.push(connection)
        }
        lastNode = functionNode
        currentY += 100
      }
    }
    
    // Emit the parsed blueprint
    emit('parse-code', { nodes: newNodes, connections: newConnections })
    
  } catch (error) {
    console.error('Error parsing code:', error)
  } finally {
    // Add a small delay to show the parsing indicator
    setTimeout(() => {
      isParsing.value = false
    }, 500)
  }
}

// Helper function to get indent level
const getIndentLevel = (line: string): number => {
  const match = line.match(/^(\s*)/)
  return match ? Math.floor(match[1].length / 2) : 0
}

// Helper function to create a node
const createNode = (type: string, name: string, x: number, y: number): BlueprintNode => {
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
    'delay': {
      name: 'Delay',
      pins: [
        { id: 'exec-in', type: 'exec', name: '', direction: 'input' },
        { id: 'duration', type: 'float', name: 'Duration', direction: 'input' },
        { id: 'exec-out', type: 'exec', name: '', direction: 'output' },
      ]
    }
  }

  const template = nodeTemplates[type as keyof typeof nodeTemplates]
  if (!template) {
    return {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'function',
      name: 'Unknown',
      x,
      y,
      pins: []
    }
  }

  return {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    name: template.name,
    x,
    y,
    pins: template.pins.map(pin => ({
      ...pin,
      id: `${pin.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }))
  }
}

// Helper function to create a connection
const createConnection = (fromNode: BlueprintNode, toNode: BlueprintNode, type: string) => {
  const fromPin = fromNode.pins.find(p => p.type === 'exec' && p.direction === 'output')
  const toPin = toNode.pins.find(p => p.type === 'exec' && p.direction === 'input')
  
  if (!fromPin || !toPin) return null
  
  return {
    id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: { nodeId: fromNode.id, pinId: fromPin.id },
    to: { nodeId: toNode.id, pinId: toPin.id },
    type,
    path: ''
  }
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(code.value)
    console.log('Code copied to clipboard')
  } catch (error) {
    console.error('Failed to copy code:', error)
  }
}

const formatCode = () => {
  // Simple formatting - in a real app, use a proper formatter
  const lines = code.value.split('\n')
  let indentLevel = 0
  const formatted = lines.map(line => {
    const trimmed = line.trim()
    
    // Decrease indent for closing braces
    if (trimmed === '}' || trimmed.startsWith('else')) {
      indentLevel = Math.max(0, indentLevel - 1)
    }
    
    const indented = '  '.repeat(indentLevel) + trimmed
    
    // Increase indent for opening braces
    if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
      indentLevel++
    }
    
    return indented
  })
  
  code.value = formatted.join('\n')
}

const syncLineNumbers = () => {
  if (codeArea.value) {
    codeArea.value.scrollTop = codeArea.value.scrollHeight - codeArea.value.clientHeight
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    const cursorPosition = codeArea.value?.selectionStart
    if (cursorPosition !== null) {
      codeArea.value.value = codeArea.value.value.slice(0, cursorPosition) + '\n' + codeArea.value.value.slice(cursorPosition)
      codeArea.value.setSelectionRange(cursorPosition + 1, cursorPosition + 1)
    }
  }
}

// Watch for blueprint changes
watch([() => props.nodes, () => props.connections], () => {
  blueprintToCode()
}, { deep: true, immediate: true })

// Watch for language changes
watch(selectedLanguage, () => {
  blueprintToCode()
})

// Manual parse function
const manualParseCode = () => {
  parseCodeToBlueprint()
}

const toggleHighlighting = () => {
  showHighlighting.value = !showHighlighting.value
}

onMounted(async () => {
  // Load PrismJS on client side only
  if (typeof window !== 'undefined') {
    try {
      const PrismModule = await import('prismjs')
      Prism = PrismModule.default
      
      // Load language components
      await import('prismjs/components/prism-javascript')
      await import('prismjs/components/prism-python')
      await import('prismjs/components/prism-c')  // Use 'c' instead of 'cpp' to avoid the error
      
      // Load theme
      await import('prismjs/themes/prism-tomorrow.css')
      
      // Force re-render of highlighted code
      blueprintToCode()
    } catch (error) {
      console.error('Failed to load PrismJS:', error)
    }
  } else {
    blueprintToCode()
  }
})
</script>

<style scoped>
.code-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.editor-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.editor-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.editor-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.editor-btn:hover {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.language-selector {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.editor-content {
  flex: 1;
  position: relative;
  display: flex;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.line-numbers {
  width: 50px;
  background: var(--bg-primary);
  color: var(--text-muted);
  padding: 12px 0;
  text-align: right;
  user-select: none;
  overflow: hidden;
}

.line-number {
  padding-right: 12px;
  height: 1.6em;
}

.code-editor-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  overflow: hidden;
}

.code-textarea {
  position: relative;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  padding: 12px;
  margin: 0;
  border: none;
  outline: none;
  resize: none;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--bg-primary);
  color: var(--text-primary);
  z-index: 2;
  white-space: pre;
  word-wrap: normal;
  overflow: auto;
  tab-size: 2;
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.code-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
  font-style: italic;
}

.code-textarea:focus {
  outline: 2px solid var(--accent-blue);
  outline-offset: -2px;
  box-shadow: inset 0 0 0 1px var(--accent-blue), 0 0 0 3px rgba(0, 120, 212, 0.1);
}

/* Enhanced scrollbar for code editor */
.code-textarea::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.code-textarea::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 6px;
}

.code-textarea::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 6px;
  border: 2px solid var(--bg-secondary);
}

.code-textarea::-webkit-scrollbar-thumb:hover {
  background: var(--accent-blue);
}

.code-textarea::-webkit-scrollbar-corner {
  background: var(--bg-secondary);
}

.parsing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--accent-blue);
  margin-left: 12px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style> 