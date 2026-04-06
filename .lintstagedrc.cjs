module.exports = {
  "*.{js,ts,tsx,css,scss,json,md,html,yml}": [
    "oxfmt --write --config ./.oxfmtrc.json --ignore-path ./.oxfmtignore --no-error-on-unmatched-pattern",
  ],
  "*.{js,ts,tsx}": ["oxlint --quiet --fix --config ./.oxlintrc.json --ignore-path ./.oxlintignore"],
};
