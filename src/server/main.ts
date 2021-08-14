import { app } from './server'
import http from 'http'

const port = 3000;
app.set('port', port);

const server = http.createServer(app);
server.listen(port);
