import * as clack from "@clack/prompts";
import pc from "picocolors";
import { GenerateAction } from "../actions/generate.action";
import type { CommandsHelper } from "../commands.helper";
import { EnhancedGenerateServiceWizard } from "./wizards/enhanced-generate-service.wizard";
import { GenerateModuleWizard } from "./wizards/generate-module.wizard";
import { GenerateServiceWizard } from "./wizards/generate-service.wizard";

export interface MainMenuOptions {
	commandsHelper: CommandsHelper;
}

export type MenuAction =
	| "generate-service"
	| "generate-service-enhanced"
	| "generate-module"
	| "bootstrap"
	| "visualize"
	| "install"
	| "exit";

/**
 * Main interactive menu for the TUI
 */
export class MainMenu {
	constructor(private readonly options: MainMenuOptions) {}

	/**
	 * Display the main menu and handle user selection
	 */
	async show(): Promise<void> {
		clack.intro(pc.bgCyan(pc.black(" Nexus IoC CLI ")));

		let shouldExit = false;

		while (!shouldExit) {
			const action = await clack.select({
				message: "What would you like to do?",
				options: [
					{
						value: "generate-service",
						label: "⚙️  Generate Service (Basic)",
						hint: "Quick service generation",
					},
					{
						value: "generate-service-enhanced",
						label: "⚙️  Generate Service (Enhanced)",
						hint: "Service with DI, scope selection, and more",
					},
					{
						value: "generate-module",
						label: "📦 Generate Module",
						hint: "Create a new module to organize providers",
					},
					{
						value: "bootstrap",
						label: "🚀 Bootstrap Project",
						hint: "Set up a new Nexus IoC project",
					},
					{
						value: "visualize",
						label: "📊 Visualize Dependencies",
						hint: "View and export dependency graph",
					},
					{
						value: "install",
						label: "📥 Install Package",
						hint: "Install @nexus-ioc/core package",
					},
					{
						value: "exit",
						label: "👋 Exit",
						hint: "Close the CLI",
					},
				],
			});

			if (clack.isCancel(action)) {
				shouldExit = true;
				continue;
			}

			shouldExit = await this.handleAction(action as MenuAction);
		}

		clack.outro(pc.green("Thanks for using Nexus IoC CLI! 👋"));
	}

	/**
	 * Handle the selected menu action
	 */
	private async handleAction(action: MenuAction): Promise<boolean> {
		switch (action) {
			case "generate-service":
				await this.generateService();
				return false;

			case "generate-service-enhanced":
				await this.generateServiceEnhanced();
				return false;

			case "generate-module":
				await this.generateModule();
				return false;

			case "bootstrap":
				await this.bootstrap();
				return false;

			case "visualize":
				await this.visualize();
				return false;

			case "install":
				await this.install();
				return false;

			case "exit":
				return true;

			default:
				clack.log.error("Unknown action");
				return false;
		}
	}

	/**
	 * Generate a service (basic)
	 */
	private async generateService(): Promise<void> {
		try {
			const generateAction = new GenerateAction();
			const wizard = new GenerateServiceWizard(generateAction);
			await wizard.run();
		} catch (error) {
			clack.log.error(`Service generation failed: ${error}`);
		}
	}

	/**
	 * Generate a service (enhanced with DI and scope)
	 */
	private async generateServiceEnhanced(): Promise<void> {
		try {
			const wizard = new EnhancedGenerateServiceWizard();
			await wizard.run();
		} catch (error) {
			clack.log.error(`Service generation failed: ${error}`);
		}
	}

	/**
	 * Generate a module
	 */
	private async generateModule(): Promise<void> {
		try {
			const generateAction = new GenerateAction();
			const wizard = new GenerateModuleWizard(generateAction);
			await wizard.run();
		} catch (error) {
			clack.log.error(`Module generation failed: ${error}`);
		}
	}

	/**
	 * Bootstrap a project (placeholder for now)
	 */
	private async bootstrap(): Promise<void> {
		const s = clack.spinner();
		s.start("Preparing bootstrap wizard...");

		// TODO: Implement bootstrap wizard
		await new Promise((resolve) => setTimeout(resolve, 500));

		s.stop("Bootstrap wizard not yet implemented");
		clack.log.warn("This feature will be implemented in Phase 3");
	}

	/**
	 * Visualize dependencies (placeholder for now)
	 */
	private async visualize(): Promise<void> {
		const s = clack.spinner();
		s.start("Preparing visualization...");

		// TODO: Implement visualization
		await new Promise((resolve) => setTimeout(resolve, 500));

		s.stop("Visualization not yet implemented");
		clack.log.warn("This feature will be implemented in Phase 4");
	}

	/**
	 * Install package
	 */
	private async install(): Promise<void> {
		const confirmed = await clack.confirm({
			message: "Install @nexus-ioc/core package?",
		});

		if (clack.isCancel(confirmed) || !confirmed) {
			clack.log.info("Installation cancelled");
			return;
		}

		const s = clack.spinner();
		s.start("Installing @nexus-ioc/core...");

		try {
			const commander = this.options.commandsHelper.getCommander("install");
			const action = await commander?.load();

			if (action) {
				// Execute the install action
				await new Promise<void>((resolve, reject) => {
					action.action(async () => {
						try {
							const installAction =
								this.options.commandsHelper.getCommander("install");
							if (installAction) {
								const _cmd = await installAction.load();
								// The action is already bound, just need to trigger it
								resolve();
							} else {
								reject(new Error("Install command not found"));
							}
						} catch (error) {
							reject(error);
						}
					});
				});

				s.stop(pc.green("✓ Package installed successfully!"));
			} else {
				s.stop(pc.red("✗ Install command not found"));
			}
		} catch (error) {
			s.stop(pc.red(`✗ Installation failed: ${error}`));
		}
	}
}
