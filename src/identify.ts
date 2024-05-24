import { Request, Response } from 'express';

export const identifyHandler = (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Here you can add the logic to process the "identify" request
  // For example, save the name to a database or perform some other operation

  return res.status(200).json({ message: `Hello, ${name}!` });
};