import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';

interface Contact {
  id: number;
  phoneNumber: string;
  email: string;
  linkedId: number | null;
  linkPrecedence: 'primary' | 'secondary';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const runQuery = (db: sqlite3.Database, query: string, params: any[] = []) => {
  return new Promise<any[]>((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const runCommand = (db: sqlite3.Database, query: string, params: any[] = []) => {
  return new Promise<{ lastID: number; changes: number }>((resolve, reject) => {
    db.run(query, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

export const identifyHandler = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
  }

  const db = new sqlite3.Database('./database.db');

  try {
    const commonEmail = await runQuery(db, 'SELECT * FROM Contact WHERE email = ?', [email]);
    const commonPhoneNumber = await runQuery(db, 'SELECT * FROM Contact WHERE phoneNumber = ?', [phoneNumber]);
    const alreadyExists = await runQuery(db, 'SELECT * FROM Contact WHERE email = ? AND phoneNumber = ?', [email, phoneNumber]);

    let response = {
      primaryContactId: "",
      emails: [] as string[],
      phoneNumbers: [] as string[],
      secondaryContactIds: [] as number[]
    };
    
    let idCheck: number;
    if (alreadyExists.length > 0) {
      //case where exact user already exists
      const alreadyExistsObj = alreadyExists[0];
      if (alreadyExistsObj.linkPrecedence === 'primary') {
        //existing user is primary
        idCheck = alreadyExistsObj.id;
      } else {
        //existing user is secondary
        idCheck = alreadyExistsObj.linkedId;
      }
    } else {
      //case where exact user does not exist
      const primaryPhone = commonPhoneNumber.filter(c => c.linkPrecedence === 'primary');
      const primaryEmail = commonEmail.filter(c => c.linkPrecedence === 'primary');

      if (primaryEmail.length > 0 && primaryPhone.length > 0) {
        //case where primary users exist with same phone and also same email
        //make the user with newer sign in date secondary 
        if (new Date(primaryEmail[0].createdAt) > new Date(primaryPhone[0].createdAt)) {
          idCheck = primaryPhone[0].id;
        } else {
          idCheck = primaryEmail[0].id;
        }
        await runCommand(db, 'UPDATE Contact SET linkedId = ?, linkPrecedence = ? WHERE id = ?', [idCheck, 'secondary', idCheck]);

      } else if (commonEmail.length > 0) {
        //case where user already existed with same email
        const primaryCommonEmail = await runQuery(db, 'SELECT * FROM Contact WHERE (linkPrecedence = ? AND email = ?) OR id = ?', ['primary', email, commonEmail[0].linkedId]);
        if (phoneNumber) {
          await runCommand(db, 'INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence) VALUES (?, ?, ?, ?)', [phoneNumber, email, primaryCommonEmail[0].id, 'secondary']);
        }
        idCheck = primaryCommonEmail[0].id;
      } else if (commonPhoneNumber.length > 0) {
        //case where user already existing with same phone number
        const primaryCommonPhoneNumber = await runQuery(db, 'SELECT * FROM Contact WHERE (linkPrecedence = ? AND phoneNumber = ?) OR id = ?', ['primary', phoneNumber, commonPhoneNumber[0].linkedId]);
        if (email) {
          await runCommand(db, 'INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence) VALUES (?, ?, ?, ?)', [phoneNumber, email, primaryCommonPhoneNumber[0].id, 'secondary']);
        }
        idCheck = primaryCommonPhoneNumber[0].id;
      } else {
        //case where fresh user
        const result = await runCommand(db, 'INSERT INTO Contact (phoneNumber, email, linkPrecedence) VALUES (?, ?, ?)', [phoneNumber, email, 'primary']);
        idCheck = result.lastID;
      }
    }
    response.primaryContactId =idCheck.toString();
    response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ? or id = ? order by linkPrecedence asc', [idCheck, idCheck])).map(row => row.email);
    response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ? or id = ? order by linkPrecedence asc', [idCheck, idCheck])).map(row => row.phoneNumber);
    response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ? ', [idCheck])).map(row => row.id);

    res.status(200).json({ contact: response });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    db.close();
  }
};
