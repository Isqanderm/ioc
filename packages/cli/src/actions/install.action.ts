import { exec } from "node:child_process";
import { AbstractAction } from "./abstract.action";

export class InstallAction extends AbstractAction {
	async handler(): Promise<void> {
		try {
			// Запускаем команду npm install --save nexus-ioc
			exec("npm install --save nexus-ioc", (error, stdout, stderr) => {
				if (error) {
					console.error(`Install error: ${error.message}`);
					return;
				}

				if (stderr) {
					console.error(`Error: ${stderr}`);
					return;
				}
			});
		} catch (err) {
			console.error(`Error: ${err}`);
		}
	}
}
