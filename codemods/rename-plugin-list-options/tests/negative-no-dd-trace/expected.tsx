const plugins = createPluginManager();

plugins.use("http", {
  whitelist: ["/health"],
  blacklist: [/admin/]
});
