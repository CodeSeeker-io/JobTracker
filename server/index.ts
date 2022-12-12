import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { userRouter } from './routes/userRouter';
import { ServerError } from './serverTypes'

const app = express();

app.use(express.json());

app.use('/user', userRouter);

app.use('/', (err: ServerError, req: Request, res: Response, next: NextFunction) => {
  const defaultErr: ServerError = {
    log: 'Unknown Express error',
    status: 500,
    message: { err: 'An error occurred (Default error response)' },
  };
  const errorObj = Object.assign({}, defaultErr, err);
  console.log(errorObj.log);
  return res.status(errorObj.status).json(errorObj.message);
})

app.listen(3333, () => console.log('server is listening on port 3333'));