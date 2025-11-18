// cypress.config.cjs
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:5173",
    defaultCommandTimeout: 12000,
    viewportWidth: 390,
    viewportHeight: 844,
    video: false,
    setupNodeEvents(on, config) {
      // aqui você pode adicionar plugins depois, se quiser
      return config;
    },
  },
});