# BSF TRAINING COMMAND ERP

MASTER PROJECT CONTEXT

## Project Purpose

This ERP is designed for a single BSF Training Company.

Example:

F Coy

Every company operates independently.

No data sharing between companies.

If BSF deploys the software to another company (A Coy, B Coy, C Coy etc.), each company will have its own isolated database and login system.

---

## Technology Stack

Frontend:

* React
* TypeScript
* Tailwind CSS

Backend:

* Firebase

Database:

* Firestore

Authentication:

* Firebase Authentication

Storage:

* Firebase Storage

---

## Primary Identity

Chest Number is the primary identity.

All modules must link through Chest Number.

Examples:

Documents

Inventory

Recovery

Training

Attendance

Issue Records

Everything must connect through Chest Number.

---

## User Roles

1. Company Commander

Full Access

Can view and monitor all modules.

Can manage users.

Can access reports.

---

2. Clerk

Can create batches.

Can create trainees.

Can update trainee information.

Can manage documents.

Can manage weekly programs.

Can manage hospital and leave records.

Cannot access finance.

Cannot access inventory.

---

3. Quarter Master

Can view trainee records.

Can manage inventory.

Can manage issue system.

Can manage recoveries.

Can manage expenses.

Can manage funds.

Cannot edit trainee personal information.

---

4. Ustad

Can manage training records only.

Cannot access finance.

Cannot access inventory.

---

## Development Rule

No hardcoded:

Items

Expenses

Recoveries

Categories

Everything must be dynamic.

---

## Current Development Status

UI:
In Progress

Firebase:
Connected

Current Focus:

Clerk Module

Quarter Master Module

Issue System

Recovery System
