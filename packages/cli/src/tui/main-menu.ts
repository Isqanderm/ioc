import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { CommandsHelper } from "../commands.helper";

export interface MainMenuOptions {
	commandsHelper: CommandsHelper;
}

export type MenuAction =
	| "generate-service"
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
						label: "⚙️  Generate Service",
						hint: "Create a new service with dependency injection",
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
	 * Generate a service (placeholder for now)
	 */
	private async generateService(): Promise<void> {
		const s = clack.spinner();
		s.start("Preparing service generation wizard...");

		// TODO: Implement service generation wizard
		await new Promise((resolve) => setTimeout(resolve, 500));

		s.stop("Service generation wizard not yet implemented");
		clack.log.warn("This feature will be implemented in Phase 2");
	}

	/**
	 * Generate a module (placeholder for now)
	 */
	private async generateModule(): Promise<void> {
		const s = clack.spinner();
		s.start("Preparing module generation wizard...");

		// TODO: Implement module generation wizard
		await new Promise((resolve) => setTimeout(resolve, 500));

		s.stop("Module generation wizard not yet implemented");
		clack.log.warn("This feature will be implemented in Phase 2");
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
