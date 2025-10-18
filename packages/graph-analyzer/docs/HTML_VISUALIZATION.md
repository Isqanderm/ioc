# Interactive HTML Visualization

The Graph Analyzer now supports generating interactive HTML visualizations of your dependency injection graphs. This provides a more user-friendly way to explore and understand your application's dependency structure compared to static PNG images.

## Features

### Visual Grouping
- **Compound Nodes**: Providers are visually grouped inside their parent modules using Cytoscape.js compound nodes
- **Clear Module Boundaries**: Each module is displayed as a container with a semi-transparent background and border
- **Hierarchical Layout**: The COSE layout algorithm respects parent-child relationships, keeping providers close to their modules
- **Easy Identification**: At a glance, you can see which providers belong to which module
- **Global Module Highlighting**: Global modules are displayed with a purple background to distinguish them from regular modules

### Interactive Graph
- **Zoom and Pan**: Navigate large dependency graphs with ease
- **Click to Explore**: Click on any node to see detailed information
- **Hover Effects**: Visual feedback when hovering over nodes
- **Search**: Quickly find specific modules or providers
- **View Modes**: Toggle between different views (all, modules only, providers only)
- **Clickable Relationships**: Navigate between related nodes by clicking on imports, providers, exports, and dependencies in the info panel

### Node Information
When you click on a node, you'll see:
- **For Modules**:
  - Module name and type
  - File path (clickable to open in your IDE)
  - Imported modules (clickable to navigate to that module)
  - Registered providers (clickable to navigate to that provider)
  - Exported providers (clickable to navigate to that provider)
  - Global status

- **For Providers**:
  - Provider token and type (Class, UseValue, UseFactory, UseClass)
  - Module that registers the provider (clickable to navigate to that module)
  - Lifecycle scope (Singleton, Request, Transient)
  - Dependencies (clickable to navigate to that dependency)
  - Type-specific information (value, factory function, implementation class)

### Interactive Navigation
The info panel makes it easy to explore your dependency graph:
- **Click on any import** in a module's "Imports" list to navigate to that module
- **Click on any provider** in a module's "Providers" or "Exports" list to navigate to that provider
- **Click on any dependency** in a provider's "Dependencies" list to navigate to that dependency
- **Click on the module name** in a provider's details to navigate back to the module

When you click on a relationship:
1. The graph automatically pans and zooms to center on the target node
2. The target node is highlighted with a visual indicator
3. The info panel updates to show the details of the newly selected node
4. The animation is smooth and takes 500ms with an ease-in-out-cubic easing function

### IDE Integration
File paths are clickable and will open directly in your IDE:
- **VS Code**: `vscode://file/{path}:{line}:{column}`
- **WebStorm/IntelliJ IDEA**: `idea://open?file={path}&line={line}`
- **Custom**: Define your own URL template

### Themes
- **Light Theme**: Default, suitable for bright environments
- **Dark Theme**: Easy on the eyes for dark mode users

## Usage

### CLI

#### Generate HTML Only
```bash
# Basic usage
graph-analyzer -f html src/main.ts

# With custom output path
graph-analyzer -f html -o output/graph.html src/main.ts

# With dark theme
graph-analyzer -f html --dark src/main.ts

# With WebStorm IDE integration
graph-analyzer -f html --ide webstorm src/main.ts

# All options combined
graph-analyzer -f html -o docs/dependencies.html --ide vscode --dark src/main.ts
```

#### Generate Multiple Formats
```bash
# Generate JSON, PNG, and HTML
graph-analyzer -f both src/main.ts  # Generates JSON and PNG (default)

# To generate HTML alongside other formats, run multiple commands:
graph-analyzer -f json -o output/graph.json src/main.ts
graph-analyzer -f png -o output/graph.png src/main.ts
graph-analyzer -f html -o output/graph.html src/main.ts
```

### Programmatic Usage

```typescript
import { GraphAnalyzer } from '@nexus-ioc/graph-analyzer';
import * as fs from 'fs';

// ... build your module graph ...

// Generate HTML with default options
const analyzer = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
  outputFormat: 'html',
  htmlOutputPath: './graph.html'
});

analyzer.parse();

// Generate HTML with custom options
const analyzerWithOptions = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
  outputFormat: 'html',
  htmlOutputPath: './graph.html',
  htmlOptions: {
    ideProtocol: 'vscode',
    darkTheme: true,
    title: 'My Application Dependencies'
  }
});

analyzerWithOptions.parse();

// Or use the generateHtml method directly
analyzer.generateHtml();
```

### Using HtmlGenerator Directly

```typescript
import { HtmlGenerator } from '@nexus-ioc/graph-analyzer';

const generator = new HtmlGenerator(modulesGraph, 'src/main.ts', {
  ideProtocol: 'webstorm',
  darkTheme: false,
  title: 'Production Dependencies',
  customIdeUrl: 'custom://open/{path}:{line}:{column}'
});

const html = generator.generate();
fs.writeFileSync('graph.html', html);
```

## Configuration Options

### GraphAnalyzerOptions

```typescript
interface GraphAnalyzerOptions {
  outputFormat?: 'json' | 'png' | 'html' | 'both';
  outputPath?: string;
  htmlOutputPath?: string;
  htmlOptions?: HtmlGeneratorOptions;
}
```

### HtmlGeneratorOptions

```typescript
interface HtmlGeneratorOptions {
  /** IDE protocol for clickable file links (default: 'vscode') */
  ideProtocol?: 'vscode' | 'webstorm' | 'idea' | 'custom';
  
  /** Custom IDE URL template (e.g., 'vscode://file/{path}:{line}:{column}') */
  customIdeUrl?: string;
  
  /** Title for the HTML page (default: 'Dependency Graph') */
  title?: string;
  
  /** Whether to use dark theme (default: false) */
  darkTheme?: boolean;
}
```

## IDE Protocol Setup

### VS Code
VS Code supports the `vscode://` protocol out of the box. No additional setup required.

```bash
graph-analyzer -f html --ide vscode src/main.ts
```

### WebStorm / IntelliJ IDEA
WebStorm and IntelliJ IDEA support the `idea://` protocol. You may need to enable it in your IDE settings.

```bash
graph-analyzer -f html --ide webstorm src/main.ts
# or
graph-analyzer -f html --ide idea src/main.ts
```

### Custom Protocol
If you're using a different IDE or want a custom URL format:

```typescript
const analyzer = new GraphAnalyzer(modulesGraph, 'src/main.ts', {
  outputFormat: 'html',
  htmlOptions: {
    ideProtocol: 'custom',
    customIdeUrl: 'atom://open?file={path}&line={line}&column={column}'
  }
});
```

## Graph Visualization Details

### Visual Grouping with Compound Nodes

The visualization uses **Cytoscape.js compound nodes** to create a clear hierarchical structure:

#### Module Containers (Parent Nodes)
- **Appearance**: Semi-transparent rounded rectangles with borders
- **Background**: Light blue (#90caf9) at 15% opacity
- **Border**: 3px solid border (#42a5f5) at 80% opacity
- **Padding**: 20px around child nodes
- **Label Position**: Top center, above the container
- **Global Modules**: Purple background (#ce93d8) with 4px border (#ab47bc)

#### Provider Nodes (Child Nodes)
- **Shape**: Ellipse
- **Size**: 80px × 80px
- **Position**: Inside their parent module container
- **Colors by Type**:
  - Class: Light green (#a5d6a7)
  - UseValue: Light green (#a5d6a7)
  - UseFactory: Light coral (#ffab91)
  - UseClass: Light yellow (#fff59d)

#### Benefits of Compound Nodes
1. **Clear Ownership**: Immediately see which providers belong to which module
2. **Reduced Visual Clutter**: No need for "provides" edges since containment shows the relationship
3. **Better Layout**: The COSE algorithm keeps related nodes together
4. **Scalability**: Works well with large graphs (25+ modules, 60+ providers)
5. **Contextual Filtering**: View modes preserve module containers for context

### Edge Types

#### Import Edges
- **Color**: Gray (#666)
- **Style**: Solid line
- **Direction**: From importing module to imported module
- **Purpose**: Shows module-to-module dependencies

#### Dependency Edges
- **Color**: Orange (#ff9800)
- **Style**: Solid line (dotted for optional dependencies)
- **Direction**: From provider to its dependencies
- **Purpose**: Shows provider-to-provider dependencies

## Interactive Controls

### View Modes
- **All**: Shows both modules (with their provider children) and all connections
- **Modules Only**: Shows module containers and import edges, hides provider nodes and dependency edges
- **Providers Only**: Shows module containers (for context) with provider nodes and dependency edges, hides import edges

Note: Module containers are always visible in "Providers Only" mode to maintain visual context and grouping.

### Search
Type in the search box to highlight matching nodes. The graph will automatically zoom to fit the highlighted nodes.

### Zoom Controls
- **Reset View**: Resets zoom to 100% and centers the graph
- **Fit to Screen**: Adjusts zoom to fit all visible nodes in the viewport

### Navigation
- **Click on nodes**: Select a node to view its details in the info panel
- **Click on relationships**: Click on any import, provider, export, or dependency in the info panel to navigate to that node
- **Smooth animations**: All navigation includes smooth pan and zoom animations for better user experience

## Browser Compatibility

The HTML visualization uses modern web technologies:
- **Cytoscape.js**: For graph rendering
- **ES6+**: Modern JavaScript features
- **CSS Grid/Flexbox**: For layout

Supported browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Examples

### Example 1: Simple Application
```bash
graph-analyzer -f html -o docs/dependencies.html src/main.ts
```

This generates a simple HTML file at `docs/dependencies.html` with default settings.

### Example 2: Dark Theme for Documentation
```bash
graph-analyzer -f html -o docs/architecture.html --dark --ide vscode src/main.ts
```

Perfect for including in your project documentation with a dark theme.

### Example 3: CI/CD Integration
```bash
# In your CI/CD pipeline
npm run build
graph-analyzer -f html -o dist/docs/dependencies.html src/main.ts

# Deploy the HTML file with your documentation
```

### Example 4: Multiple Outputs
```bash
# Generate all formats for different use cases
graph-analyzer -f json -o output/graph.json src/main.ts  # For programmatic analysis
graph-analyzer -f png -o output/graph.png src/main.ts    # For static documentation
graph-analyzer -f html -o output/graph.html src/main.ts  # For interactive exploration
```

## Tips and Best Practices

1. **Use Dark Theme for Presentations**: The dark theme is easier on the eyes during presentations
2. **Include in Documentation**: Add the HTML file to your project documentation for easy reference
3. **CI/CD Integration**: Generate the HTML file in your CI/CD pipeline to keep it up-to-date
4. **Share with Team**: The HTML file is self-contained and can be easily shared with team members
5. **Use Search**: For large graphs, use the search feature to quickly find specific modules or providers
6. **View Modes**: Use view modes to focus on specific aspects of your dependency graph

## Troubleshooting

### IDE Links Not Working

**Problem**: Clicking on file paths doesn't open the IDE.

**Solution**: 
- Make sure your IDE supports the protocol (VS Code, WebStorm, IntelliJ IDEA)
- Check if the protocol handler is registered in your system
- Try using a different IDE protocol option

### Graph Too Large

**Problem**: The graph is too large and difficult to navigate.

**Solution**:
- Use the search feature to find specific nodes
- Use view modes to focus on modules or providers only
- Use the zoom controls to navigate
- Consider breaking down your application into smaller modules

### Styling Issues

**Problem**: The HTML doesn't look right in your browser.

**Solution**:
- Make sure you're using a modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- Check if JavaScript is enabled
- Try opening the file in a different browser

## Future Enhancements

Planned features for future releases:
- Export graph as image from the HTML page
- Filter by module or provider type
- Highlight circular dependencies
- Show dependency depth
- Collapsible module groups
- Performance metrics overlay

