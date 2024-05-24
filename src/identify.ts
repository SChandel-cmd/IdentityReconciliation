import { Request, Response } from 'express';
import sqlite3 from 'sqlite3';

// Interface for Contact
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

// Helper function to run a query and return a promise
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

// Helper function to run a command and return a promise
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

// Identify Handler
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

    if (alreadyExists.length > 0) {
      const alreadyExistsObj = alreadyExists[0];
      if (alreadyExistsObj.linkPrecedence === 'primary') {
        response.primaryContactId = alreadyExistsObj.id.toString();
        response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ?', [alreadyExistsObj.id])).map(row => row.email);
        response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ?', [alreadyExistsObj.id])).map(row => row.phoneNumber);
        response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ?', [alreadyExistsObj.id])).map(row => row.id);
      } else {
        response.primaryContactId = alreadyExistsObj.linkedId!.toString();
        response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ?', [alreadyExistsObj.linkedId])).map(row => row.email);
        response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ?', [alreadyExistsObj.linkedId])).map(row => row.phoneNumber);
        response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ?', [alreadyExistsObj.linkedId])).map(row => row.id);
      }
    } else {
      const primaryPhone = commonPhoneNumber.filter(c => c.linkPrecedence === 'primary');
      const primaryEmail = commonEmail.filter(c => c.linkPrecedence === 'primary');

      if (primaryEmail.length > 0 && primaryPhone.length > 0) {
        let obj: Contact;
        if (new Date(primaryEmail[0].createdAt) > new Date(primaryPhone[0].createdAt)) {
          obj = primaryEmail[0];
          obj.linkedId = primaryPhone[0].id;
          obj.linkPrecedence = 'secondary';
          await runCommand(db, 'UPDATE Contact SET linkedId = ?, linkPrecedence = ? WHERE id = ?', [obj.linkedId, obj.linkPrecedence, obj.id]);
          response.primaryContactId = primaryPhone[0].id.toString();
          response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ?', [primaryPhone[0].id])).map(row => row.email);
          response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ?', [primaryPhone[0].id])).map(row => row.phoneNumber);
          response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ?', [primaryPhone[0].id])).map(row => row.id);
        } else {
          obj = primaryPhone[0];
          obj.linkedId = primaryEmail[0].id;
          obj.linkPrecedence = 'secondary';
          await runCommand(db, 'UPDATE Contact SET linkedId = ?, linkPrecedence = ? WHERE id = ?', [obj.linkedId, obj.linkPrecedence, obj.id]);
          response.primaryContactId = primaryEmail[0].id.toString();
          response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ?', [primaryEmail[0].id])).map(row => row.email);
          response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ?', [primaryEmail[0].id])).map(row => row.phoneNumber);
          response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ?', [primaryEmail[0].id])).map(row => row.id);
        }
      } else if (commonEmail.length > 0) {
        const primaryCommonEmail = await runQuery(db, 'SELECT * FROM Contact WHERE (linkPrecedence = ? AND email = ?) OR id = ?', ['primary', email, commonEmail[0].linkedId]);
        if (phoneNumber) {
          await runCommand(db, 'INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence) VALUES (?, ?, ?, ?)', [phoneNumber, email, primaryCommonEmail[0].id, 'secondary']);
        }
        response.primaryContactId = primaryCommonEmail[0].id.toString();
        response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ?', [primaryCommonEmail[0].id])).map(row => row.email).concat([primaryCommonEmail[0].email]);
        response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ?', [primaryCommonEmail[0].id])).map(row => row.phoneNumber);
        response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ?', [primaryCommonEmail[0].id])).map(row => row.id);
      } else if (commonPhoneNumber.length > 0) {
        const primaryCommonPhoneNumber = await runQuery(db, 'SELECT * FROM Contact WHERE (linkPrecedence = ? AND phoneNumber = ?) OR id = ?', ['primary', phoneNumber, commonPhoneNumber[0].linkedId]);
        if (email) {
          await runCommand(db, 'INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence) VALUES (?, ?, ?, ?)', [phoneNumber, email, primaryCommonPhoneNumber[0].id, 'secondary']);
        }
        response.primaryContactId = primaryCommonPhoneNumber[0].id.toString();
        response.emails = (await runQuery(db, 'SELECT DISTINCT email FROM Contact WHERE linkedId = ?', [primaryCommonPhoneNumber[0].id])).map(row => row.email).concat([primaryCommonPhoneNumber[0].email]);
        response.phoneNumbers = (await runQuery(db, 'SELECT DISTINCT phoneNumber FROM Contact WHERE linkedId = ?', [primaryCommonPhoneNumber[0].id])).map(row => row.phoneNumber);
        response.secondaryContactIds = (await runQuery(db, 'SELECT DISTINCT id FROM Contact WHERE linkedId = ?', [primaryCommonPhoneNumber[0].id])).map(row => row.id);
      } else {
        const result = await runCommand(db, 'INSERT INTO Contact (phoneNumber, email, linkPrecedence) VALUES (?, ?, ?)', [phoneNumber, email, 'primary']);
        response.primaryContactId = result.lastID.toString();
        response.emails = [email];
        response.phoneNumbers = [phoneNumber];
        response.secondaryContactIds = [];
      }
    }

    res.status(200).json({ contact: response });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    db.close();
  }
};
