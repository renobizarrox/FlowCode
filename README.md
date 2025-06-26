# 🎯 Blueprint Code Editor

A visual programming interface inspired by **Unreal Engine 5 Blueprints**, built with **Nuxt.js 3** and **Vuetify**. Create visual representations of code using a node-based system with intuitive drag-and-drop functionality.

![Blueprint Editor Preview](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Blueprint+Editor+Preview)

## ✨ Features

### 🎨 **Visual Node System**
- **Drag & Drop Interface**: Easily add nodes from the palette to the canvas
- **Pin-to-Pin Connections**: Connect nodes with precision using color-coded pins
- **Smart Connection Logic**: Automatic validation of compatible pin types
- **Real-time Visual Feedback**: Hover effects and smooth animations

### 🔧 **Node Types**
- **🔀 Flow Control**: Branch (if), While Loop
- **⚡ Events**: Begin Play
- **🧮 Math Operations**: Add, Multiply, Equal comparison
- **📊 Variables**: Get Variable
- **🛠️ Functions**: Function Call, Print String
- **⏱️ Utilities**: Delay, Cast

### 🎯 **Interactive Canvas**
- **Pan and Zoom**: Navigate large blueprints easily
- **Multi-Selection**: Select multiple nodes with Ctrl/Cmd+click
- **Grid Background**: UE5-style dotted grid pattern
- **Responsive Design**: Works on different screen sizes

### 🌙 **Dark Modern UI**
- **UE5-Inspired Theme**: Professional dark color scheme
- **Color-Coded Pins**: Different colors for exec, bool, int, float, string, object
- **Smooth Animations**: Polished interactions and transitions
- **Material Design Icons**: Clear and recognizable iconography

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Yarn or npm package manager

### Installation

1. **Clone and setup:**
```bash
cd blueprint-editor
yarn install
```

2. **Start development server:**
```bash
yarn dev
```

3. **Open in browser:**
Navigate to `http://localhost:3000`

## 🎮 How to Use

### Adding Nodes
1. **From Palette**: Click or drag any node from the right-side palette
2. **To Canvas**: Drop nodes anywhere on the grid canvas
3. **Categories**: Browse organized node categories (Flow Control, Events, Math, etc.)

### Connecting Nodes
1. **Click and Drag**: Click on any output pin (right side of node)
2. **Drop on Input**: Drag to an input pin (left side of another node)
3. **Type Matching**: Connections only work between compatible pin types
4. **Visual Feedback**: Pins light up when hovering with compatible connections

### Canvas Navigation
- **Pan**: Click and drag empty canvas area
- **Select Nodes**: Click on nodes to select them
- **Multi-Select**: Hold Ctrl/Cmd while clicking for multiple selection
- **Delete**: Use the X button on selected nodes

### Toolbar Functions
- **🗑️ Clear**: Remove all nodes and connections
- **💾 Save**: Save current blueprint (console log for now)
- **📁 Load**: Load saved blueprints (console log for now)

## 🛠️ Technology Stack

- **Framework**: Nuxt.js 3.17+ (Vue 3, TypeScript)
- **UI Library**: Vuetify 3.9+ (Material Design)
- **Styling**: Custom CSS with CSS Variables
- **Icons**: Material Design Icons (@mdi/font)
- **Fonts**: Inter (UI), JetBrains Mono (code)

## 📁 Project Structure

```
blueprint-editor/
├── components/
│   ├── BlueprintEditor.vue    # Main editor component
│   ├── BlueprintNode.vue      # Individual draggable nodes  
│   └── NodePalette.vue        # Right-side node palette
├── assets/css/
│   └── main.css              # UE5-inspired styling
├── plugins/
│   └── vuetify.client.ts     # Vuetify configuration
├── app.vue                   # Root application component
└── nuxt.config.ts           # Nuxt configuration
```

## 🎨 Customization

### Adding New Node Types

1. **Update Node Templates** in `BlueprintEditor.vue`:
```typescript
const nodeTemplates = {
  'your-node': {
    name: 'Your Node Name',
    pins: [
      { id: 'input', type: 'string', name: 'Input', direction: 'input' },
      { id: 'output', type: 'string', name: 'Output', direction: 'output' }
    ]
  }
}
```

2. **Add to Palette** in `NodePalette.vue`:
```typescript
{
  name: 'Your Category',
  icon: 'mdi-your-icon',
  nodes: [
    {
      type: 'your-node',
      name: 'Your Node',
      description: 'Description of what it does'
    }
  ]
}
```

3. **Add Colors** in CSS and components for the new node type

### Styling Customization

Colors and themes can be customized in:
- `assets/css/main.css` - CSS variables for colors
- `plugins/vuetify.client.ts` - Vuetify theme colors

## 🐛 Known Issues & Roadmap

### Current Limitations
- Save/Load functionality logs to console (not persistent)
- Pin connections are visual only (no execution logic)
- Limited node types (extensible architecture in place)

### Future Enhancements
- [ ] Persistent save/load to file system
- [ ] Code generation from blueprints
- [ ] More node types (loops, functions, classes)
- [ ] Blueprint validation and error checking
- [ ] Minimap for large blueprints
- [ ] Copy/paste functionality
- [ ] Undo/redo system

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

*Built with ❤️ using Nuxt.js and Vuetify*
