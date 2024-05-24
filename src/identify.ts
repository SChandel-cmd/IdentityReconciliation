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

export const identifyHandler = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'At least one of email or phoneNumber is required' });
  }

  try {
    // Open a SQLite database connection
    const db = new sqlite3.Database('./database.db');

    // Find existing contacts with the same email or phone number
    const contacts: Contact[] = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM Contact WHERE phoneNumber = ? OR email = ?', [phoneNumber, email], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as Contact[]);
        }
      });
    });

    let primaryContact: Contact;
    let secondaryContacts: number[] = [];

    if (contacts.length > 0) {
      // Sort contacts by createdAt to find the primary contact
      contacts.sort((a: Contact, b: Contact) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      primaryContact = contacts[0];

      // Update linkPrecedence for secondary contacts
      for (let i = 1; i < contacts.length; i++) {
        if (contacts[i].linkPrecedence !== 'secondary') {
          await new Promise<void>((resolve, reject) => {
            db.run(
              'UPDATE Contact SET linkedId = ?, linkPrecedence = ? WHERE id = ?',
              [primaryContact.id, 'secondary', contacts[i].id],
              (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          });
        }
        secondaryContacts.push(contacts[i].id);
      }
    } else {
      // Create a new primary contact if no existing contacts are found
      const result = await new Promise<{ lastID: number }>((resolve, reject) => {
        db.run(
          'INSERT INTO Contact (phoneNumber, email, linkPrecedence) VALUES (?, ?, ?)',
          [phoneNumber, email, 'primary'],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ lastID: this.lastID });
            }
          }
        );
      });
      primaryContact = {
        id: result.lastID,
        phoneNumber,
        email,
        linkedId: null,
        linkPrecedence: 'primary',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };
    }

    // Prepare the response
    const response = {
      contact: {
        primaryContactId: primaryContact.id,
        emails: [primaryContact.email].concat(contacts.filter(c => c.email && c.email !== primaryContact.email).map(c => c.email)),
        phoneNumbers: [primaryContact.phoneNumber].concat(contacts.filter(c => c.phoneNumber && c.phoneNumber !== primaryContact.phoneNumber).map(c => c.phoneNumber)),
        secondaryContactIds: secondaryContacts
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
