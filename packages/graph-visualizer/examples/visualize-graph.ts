import * as path from "node:path";
import { StaticGraphVisualizer } from "../src";

// This module graph is deliberately circular (AppModule -> TransportModule ->
// CircleModule -> AppModule, and FirstModule <-> SecondModule) and has a
// provider cycle (AppService <-> SecondProvider) to demonstrate the red
// cycle-highlighting in the rendered graph. Analysis is fully static — this
// script never runs the application, it only reads the .ts source below.
const visualizer = new StaticGraphVisualizer(
	path.join(__dirname, "entry.ts"),
	{
		tsConfigPath: path.join(__dirname, "tsconfig.json"),
		checkCircular: true,
	},
);

visualizer.renderPng(path.join(__dirname, "graph.png"));
visualizer.renderHtml(path.join(__dirname, "graph.html"));

console.log("Graph rendered to graph.png and graph.html");
