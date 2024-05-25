# Bitespeed Backend Task: Identity Reconciliation

## Introduction
This project addresses the challenge of reconciling customer identities across multiple purchases with different contact information. The system ensures a seamless and personalized customer experience by linking orders to a single customer identity.

## Technology Stack
- **Node.js** with **TypeScript**
- **SQLite** database

## Database Schema
The `Contact` table schema:
- `id`: Integer, unique identifier
- `phoneNumber`: String, optional
- `email`: String, optional
- `linkedId`: Integer, references another `Contact`
- `linkPrecedence`: Enum, "primary" or "secondary"
- `createdAt`: DateTime
- `updatedAt`: DateTime
- `deletedAt`: DateTime, optional

## Task Description
Implement a solution to track and link customer contact information (email and phone number) across multiple orders. Ensure that the oldest `Contact` entry is marked as "primary" and subsequent entries as "secondary".

## Example
If a customer places orders with different combinations of email and phone number, the entries in the database will be linked based on shared information, maintaining the primary-secondary relationship.

## Setup
1. Clone the repository
   ```sh
   git clone <repository-url>
   ```
2. Install dependencies
   ```sh
   npm install
   ```
3. Run the server
   ```sh
   npx ts-node src/index.ts
   ```
## Usage
The server can be accessed at https://identityreconciliation-ondo.onrender.com/identify. To identify customer identities, make a POST request to this endpoint with the following JSON structure:
  ```json
  {
  "email": "customer@example.com",
  "phoneNumber": "1234567890"
  }
  ```
## PS. My resume is also available in the root folder.
