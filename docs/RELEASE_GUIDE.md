# Release Guide

This document explains how to create releases for the Nexus IoC monorepo.

## Release Workflows

### 1. Automatic Release (publish.yml)

**Trigger:** Push to `main` branch

**Behavior:**
- Automatically runs when code is pushed to main
- Only creates releases if conventional commits are found since the last tag
- Follows semantic versioning based on commit messages

**Requirements:**
- Commits must follow conventional commit format:
  - `feat:` - new features (minor version bump)
  - `fix:` - bug fixes (patch version bump)
  - `BREAKING CHANGE:` - breaking changes (major version bump)
  - `perf:` - performance improvements (patch version bump)

**Example:**
```bash
git commit -m "feat: add new dependency injection feature"
git commit -m "fix: resolve circular dependency issue"
git commit -m "feat!: change API signature

BREAKING CHANGE: The Container.get() method now requires a type parameter"
```

### 2. Manual Release (manual-release.yml)

**Trigger:** Manual dispatch via GitHub Actions UI

**Use Cases:**
- Force release when automatic workflow skips publishing
- Create releases without conventional commits
- Test release process with dry run
- Create specific version types (patch/minor/major/prerelease)

## How to Use Manual Release

### Step 1: Navigate to GitHub Actions

1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. Find "Manual Release" in the workflow list
4. Click "Run workflow"

### Step 2: Configure Release Options

**Release Type:**
- `auto` - Use conventional commits to determine version bump
- `patch` - Force patch version bump (0.0.X)
- `minor` - Force minor version bump (0.X.0)
- `major` - Force major version bump (X.0.0)
- `prerelease` - Create prerelease version (0.0.0-alpha.X)

**Force Release:**
- `false` - Only release if conventional commits are found
- `true` - Force release even without conventional commits

**Dry Run:**
- `false` - Perform actual release
- `true` - Test the process without publishing

### Step 3: Monitor the Release

The workflow will:
1. ✅ Run linting and tests
2. ✅ Build all packages
3. ✅ Verify package integrity
4. ✅ Check release conditions
5. ✅ Create version bump and tags
6. ✅ Push changes to repository
7. ✅ Publish to NPM
8. ✅ Create GitHub releases

## Troubleshooting

### "No conventional commits found"

**Problem:** Automatic workflow skips publishing because no conventional commits were found.

**Solutions:**
1. **Use Manual Release:** Enable "Force release" option
2. **Fix commit messages:** Amend recent commits to follow conventional format
3. **Create new commit:** Add a conventional commit for the changes

### "No version changes detected"

**Problem:** Lerna didn't detect any changes that require version bumps.

**Solutions:**
1. **Check package changes:** Ensure there are actual code changes in packages
2. **Force release:** Use manual workflow with "Force release" enabled
3. **Check lerna.json:** Verify Lerna configuration is correct

### "NPM publish failed"

**Problem:** Publishing to NPM failed due to authentication or package issues.

**Solutions:**
1. **Check NPM_TOKEN:** Ensure the secret is set correctly in repository settings
2. **Verify package names:** Check if package names are available on NPM
3. **Check permissions:** Ensure the NPM token has publish permissions

## Best Practices

### Commit Messages

Always use conventional commit format for automatic releases:

```bash
# Good examples
git commit -m "feat: add container scoping support"
git commit -m "fix: resolve memory leak in resolver"
git commit -m "docs: update API documentation"
git commit -m "test: add integration tests for modules"

# Bad examples (won't trigger automatic release)
git commit -m "add new feature"
git commit -m "bug fix"
git commit -m "update code"
```

### Release Strategy

1. **Development:** Use feature branches and conventional commits
2. **Testing:** Use manual release with dry run to test the process
3. **Production:** Let automatic workflow handle releases, use manual for exceptions

### Version Management

- **Patch (0.0.X):** Bug fixes, documentation updates, test improvements
- **Minor (0.X.0):** New features, non-breaking API additions
- **Major (X.0.0):** Breaking changes, API modifications
- **Prerelease:** Alpha/beta versions for testing

## Package Structure

The monorepo contains these packages:

- `@nexus-ioc/core` - Main IoC container
- `@nexus-ioc/testing` - Testing utilities
- `@nexus-ioc/cli` - Command-line interface
- `@nexus-ioc/shared` - Shared interfaces and types

All packages are versioned independently using Lerna's independent versioning mode.

## Environment Variables

Required secrets in GitHub repository settings:

- `NPM_TOKEN` - NPM authentication token for publishing
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

## Support

If you encounter issues with releases:

1. Check the GitHub Actions logs for detailed error messages
2. Verify all required secrets are configured
3. Ensure your commits follow conventional commit format
4. Use manual release workflow for troubleshooting
