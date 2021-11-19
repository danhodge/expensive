import * as core from 'express-serve-static-core';
import express from 'express';
import { Router } from 'express';
import { default as exphbs } from 'express-handlebars';
import { router } from './routes';

export function createApp(router: Router): core.Express {
  const app = express();

  // handle JSON requests (order is important - this needs to be before the routes are defined)
  app.use(express.json());

  // parse CSV bodies using the text body parser
  app.use(express.text({ type: "text/csv" }));


  app.use("/", router);

  // serve static files out of the build/public/ directory
  app.use(express.static('build/public'));

  app.engine(".hbs", exphbs({
    extname: ".hbs",
    helpers: require("./handlebars_helpers")
  }));

  app.set("views", "build/views");
  app.set("view engine", ".hbs");

  // var route, routes = new Array<string>();
  // app._router.stack.forEach(function (middleware: { route: string, name: string, handle: { stack: [] } }) {
  //   if (middleware.route) { // routes registered directly on the app
  //     routes.push(middleware.route);
  //   } else if (middleware.name === 'router') { // router middleware
  //     middleware.handle.stack.forEach(function (handler: { route: string }) {
  //       route = handler.route;
  //       route && routes.push(route);
  //     });
  //   }
  // });
  // console.log(`ROUTES = ${JSON.stringify(routes)}`);
  // console.log(`ROUTES ${JSON.stringify(app._router.stack)}`);

  return app;
}

export const app = createApp(router);
