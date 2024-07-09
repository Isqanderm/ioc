module.exports = {
	lerna: {
		packages: ["packages/*"],
		independent: true,
	},
	conventionalChangelog: {
		preset: "angular",
		releaseCount: 0,
	},
	scripts: {
		postchangelog: "git add CHANGELOG.md",
	},
};
