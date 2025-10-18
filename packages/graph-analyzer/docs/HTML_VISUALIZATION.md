# Interactive HTML Visualization

The Graph Analyzer now supports generating interactive HTML visualizations of your dependency injection graphs. This provides a more user-friendly way to explore and understand your application's dependency structure compared to static PNG images.

## Features

### Interactive Graph
- **Zoom and Pan**: Navigate large dependency graphs with ease
- **Click to Explore**: Click on any node to see detailed information
- **Hover Effects**: Visual feedback when hovering over nodes
- **Search**: Quickly find specific modules or providers
- **View Modes**: Toggle between different views (all, modules only, providers only)

### Node Information
When you click on a node, you'll see:
- **For Modules**:
  - Module name and type
  - File path (clickable to open in your IDE)
  - Imported modules
  - Registered providers
  - Exported providers
  - Global status

- **For Providers**:
  - Provider token and type (Class, UseValue, UseFactory, UseClass)
  - Module that registers the provider
  - Lifecycle scope (Singleton, Request, Transient)
  - Dependencies
  - Type-specific information (value, factory function, implementation class)

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

### Node Types

#### Module Nodes
- **Shape**: Rounded rectangle
- **Color**: Light blue (#90caf9)
- **Global Modules**: Purple (#ce93d8) with thicker border

#### Provider Nodes
- **Shape**: Ellipse
- **Colors**:
  - Class: Light blue (#90caf9)
  - UseValue: Light green (#a5d6a7)
  - UseFactory: Light coral (#ffab91)
  - UseClass: Light yellow (#fff59d)

### Edge Types

#### Import Edges
- **Color**: Gray (#666)
- **Style**: Solid line
- **Direction**: From importing module to imported module

#### Provides Edges
- **Color**: Green (#4caf50)
- **Style**: Dashed line
- **Direction**: From module to provider

#### Dependency Edges
- **Color**: Orange (#ff9800)
- **Style**: Solid line (dotted for optional dependencies)
- **Direction**: From provider to its dependencies

## Interactive Controls

### View Modes
- **All**: Shows both modules and providers with all connections
- **Modules Only**: Shows only module nodes and import edges
- **Providers Only**: Shows only provider nodes and dependency edges

### Search
Type in the search box to highlight matching nodes. The graph will automatically zoom to fit the highlighted nodes.

### Zoom Controls
- **Reset View**: Resets zoom to 100% and centers the graph
- **Fit to Screen**: Adjusts zoom to fit all visible nodes in the viewport

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

