module.exports = {
  "*.ts": ["eslint --fix", "prettier --write", "tsc-files --noEmit"],
};
