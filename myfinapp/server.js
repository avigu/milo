require('dotenv').config();
const express = require('express');
const { createLogger } = require('./utils/logger');

const log = createLogger('SERVER');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Import main routes
const mainRoutes = require('./routes');
app.use('/', mainRoutes);

app.listen(port, () => {
  log.info(`Server started`, { port, nodeEnv: process.env.NODE_ENV || 'development' });
});