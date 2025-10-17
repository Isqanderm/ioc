# Automatic Versioning with Lerna and Conventional Commits

This project uses **Lerna** with **Conventional Commits** for automatic semantic versioning and changelog generation.

## 🎯 How It Works

When code is merged to the `main` branch, the CI/CD pipeline automatically:

1. **Analyzes commit messages** since the last release
2. **Determines version bump** based on commit types:
   - `feat:` → **Minor** version bump (0.x.0)
   - `fix:` → **Patch** version bump (0.0.x)
   - `BREAKING CHANGE:` → **Major** version bump (x.0.0)
3. **Updates package.json** versions in affected packages
4. **Generates CHANGELOG.md** for each package
5. **Creates git tags** for each released package
6. **Pushes changes** back to the repository
7. **Creates GitHub releases** with release notes
8. **Publishes packages** to NPM registry

## 📝 Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

| Type | Description | Version Bump | Example |
|------|-------------|--------------|---------|
| `feat` | New feature | **Minor** (0.x.0) | `feat(core): add lazy loading support` |
| `fix` | Bug fix | **Patch** (0.0.x) | `fix(testing): resolve mock cleanup issue` |
| `docs` | Documentation only | None | `docs(readme): update installation guide` |
| `style` | Code style changes | None | `style: format code with biome` |
| `refactor` | Code refactoring | None | `refactor(core): simplify container logic` |
| `perf` | Performance improvements | **Patch** (0.0.x) | `perf(core): optimize dependency resolution` |
| `test` | Adding tests | None | `test(cli): add template generation tests` |
| `chore` | Maintenance tasks | None | `chore: update dependencies` |
| `ci` | CI/CD changes | None | `ci: add coverage check workflow` |
| `build` | Build system changes | None | `build: update tsconfig` |

### Breaking Changes

To trigger a **major version bump**, include `BREAKING CHANGE:` in the commit footer:

```
feat(core)!: redesign module API

BREAKING CHANGE: Module.register() now requires options object instead of individual parameters
```

Or use the `!` suffix after the type/scope:

```
feat(core)!: redesign module API
```

## 🔄 Versioning Workflow

### Independent Versioning

This monorepo uses **independent versioning** mode. Each package maintains its own version number and is versioned independently based on its changes.

**Example:**
- If only `@nexus-ioc/core` has changes → only `@nexus-ioc/core` version bumps
- If both `@nexus-ioc/core` and `@nexus-ioc/cli` have changes → both versions bump independently

### Version Bump Logic

```
Current version: 0.4.2

feat: new feature        → 0.5.0 (minor bump)
fix: bug fix            → 0.4.3 (patch bump)
BREAKING CHANGE         → 1.0.0 (major bump)
docs: update docs       → 0.4.2 (no bump)
```

### Multiple Commits

When multiple commits are merged, the **highest** version bump wins:

```
Commits:
- fix: resolve bug A
- feat: add feature B
- fix: resolve bug C

Result: Minor bump (0.x.0) because feat > fix
```

## 🚀 Publishing Process

### Automatic Publishing (Recommended)

1. **Create feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit using conventional commits:**
   ```bash
   git add .
   npm run commit  # Interactive commitizen prompt
   # OR
   git commit -m "feat(core): add new feature"
   ```

3. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   ```

4. **Merge PR to main:**
   - Once PR is approved and merged to `main`
   - CI/CD automatically versions and publishes packages
   - No manual version updates needed!

### Manual Publishing (Emergency)

If you need to manually publish:

```bash
# 1. Version packages
npx lerna version --conventional-commits

# 2. Publish to NPM
npx lerna publish from-git
```

## 📋 Configuration

### lerna.json

```json
{
  "version": "independent",
  "command": {
    "version": {
      "conventionalCommits": true,
      "changelogPreset": "angular",
      "message": "chore(release): publish %s",
      "createRelease": "github"
    }
  }
}
```

### Key Options

- `conventionalCommits: true` - Enable automatic version determination
- `changelogPreset: "angular"` - Use Angular commit convention
- `message: "chore(release): publish %s"` - Commit message template
- `createRelease: "github"` - Automatically create GitHub releases

## 🔍 Examples

### Example 1: Bug Fix

```bash
# Commit
git commit -m "fix(core): resolve circular dependency detection"

# Result after merge to main:
# - @nexus-ioc/core: 0.4.2 → 0.4.3 (patch bump)
# - CHANGELOG.md updated with fix
# - Git tag: @nexus-ioc/core@0.4.3
# - Published to NPM
```

### Example 2: New Feature

```bash
# Commit
git commit -m "feat(cli): add module scaffolding command"

# Result after merge to main:
# - @nexus-ioc/cli: 0.2.1 → 0.3.0 (minor bump)
# - CHANGELOG.md updated with feature
# - Git tag: @nexus-ioc/cli@0.3.0
# - Published to NPM
```

### Example 3: Breaking Change

```bash
# Commit
git commit -m "feat(core)!: redesign container API

BREAKING CHANGE: Container.get() now returns Promise instead of sync value"

# Result after merge to main:
# - @nexus-ioc/core: 0.4.2 → 1.0.0 (major bump)
# - CHANGELOG.md updated with breaking change
# - Git tag: @nexus-ioc/core@1.0.0
# - Published to NPM
```

### Example 4: Multiple Packages

```bash
# Commits in PR:
git commit -m "feat(core): add lazy loading"
git commit -m "feat(testing): add lazy loading test utilities"
git commit -m "docs(readme): update lazy loading examples"

# Result after merge to main:
# - @nexus-ioc/core: 0.4.2 → 0.5.0 (minor bump)
# - @nexus-ioc/testing: 0.4.2 → 0.5.0 (minor bump)
# - @nexus-ioc/cli: 0.2.1 → 0.2.1 (no change)
# - Both packages published to NPM
```

## 🛠️ Troubleshooting

### No Version Bump Occurred

**Possible reasons:**
- No commits with `feat:`, `fix:`, or `BREAKING CHANGE:` since last release
- Only commits with `docs:`, `chore:`, `style:`, etc.
- Check CI logs for "No version changes detected"

**Solution:**
- Ensure commits follow conventional commit format
- Use `feat:` or `fix:` for changes that should trigger releases

### Version Bump Too Large/Small

**Problem:** Expected patch but got minor, or vice versa

**Solution:**
- Review commit messages - ensure correct type is used
- `feat:` always triggers minor bump
- `fix:` always triggers patch bump
- Use correct type for your change

### Failed to Push Tags

**Problem:** CI fails at "Push version changes and tags" step

**Solution:**
- Check GitHub token permissions
- Ensure `GITHUB_TOKEN` has write access to repository
- Verify branch protection rules allow CI to push

## 📚 Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Lerna Documentation](https://lerna.js.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)

## 🎓 Best Practices

1. **Always use conventional commits** - Enables automatic versioning
2. **Be specific in scope** - Helps identify which package changed
3. **Write clear subjects** - Appears in CHANGELOG
4. **Include body for complex changes** - Provides context
5. **Mark breaking changes explicitly** - Prevents accidental major bumps
6. **Review CHANGELOG before release** - Ensure it makes sense
7. **Test in feature branch** - CI validates before merge

---

**Questions?** Check [CONTRIBUTING.md](../CONTRIBUTING.md) or open an issue.

