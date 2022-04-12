const withTM = require("next-transpile-modules")(["ui", "contracts"]);

module.exports = withTM({
  reactStrictMode: true,
});
