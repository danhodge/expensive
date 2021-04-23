import express from 'express';
import { default as exphbs } from 'express-handlebars';
import Router from './routes';

export const app = express();

// handle JSON requests (order is important - this needs to be before the routes are defined)
app.use(express.json());

app.use("/", Router);

// serve static files out of the build/public/ directory
app.use(express.static('build/public'));

app.engine(".hbs", exphbs({
  extname: ".hbs",
  helpers: require("./handlebars_helpers")
}));

app.set("views", "build/views");
app.set("view engine", ".hbs");
