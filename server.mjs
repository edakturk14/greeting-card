import http from 'node:http';
import handler from './lib/app.mjs';
http.createServer(handler).listen(Number(process.env.PORT||3001),'0.0.0.0',()=>console.log(`SendFiggle: http://localhost:${process.env.PORT||3001}`));
