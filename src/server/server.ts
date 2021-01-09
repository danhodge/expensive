import express from 'express';
import Router from './routes';

export const app = express();

// handle JSON requests (order is important - this needs to be before the routes are defined)
app.use(express.json());

app.use("/", Router);

app.set("views", "build/views");
app.set("view engine", "hbs");
