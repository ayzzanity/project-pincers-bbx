const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`Project Pincers backend listening on port ${env.port}`);
});
