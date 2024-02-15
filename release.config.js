const { execSync } = require("child_process");

function isDryRun() {
  return process.argv.includes("--dry-run");
}

function getLocalRepoUrl() {
  const rootDir = execSync("git rev-parse --show-toplevel").toString().trim();

  return `file://${rootDir}/.git`;
}

function getCurrentBranch() {
  return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}

function getDryRunConfig() {
  return {
    repositoryUrl: getLocalRepoUrl(),
    branches: [getCurrentBranch()],
    preset: "conventionalcommits",
    plugins: [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
    ],
  };
}

module.exports = isDryRun()
  ? getDryRunConfig()
  : {
      branches: ["main"],
      preset: "conventionalcommits",
      plugins: [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        [
          "@semantic-release/npm",
          {
            npmPublish: false,
            tarballDir: ".",
          },
        ],
        [
          "@semantic-release/github",
          {
            assets: ["*.tgz"],
          },
        ],
      ],
    };
