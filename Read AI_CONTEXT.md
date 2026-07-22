# PROJECT_STATUS.md

# BSF TRAINING COMMAND ERP

Last Updated: 2026

---

# PROJECT STATUS

Current Phase:

Phase 1

Core System Development

Status:

IN PROGRESS

---

# PROJECT OVERVIEW

Company Type:

Single Company Deployment

Example:

F Coy

Architecture:

Each Company Independent

No Data Sharing Between Companies

Technology:

React

TypeScript

Tailwind CSS

Firebase

Firestore

Firebase Authentication

Firebase Storage

---

# COMPLETED

## Project Planning

✔ ERP Architecture Defined

✔ User Roles Defined

✔ Firebase Selected

✔ Single Company Model Finalized

✔ Dynamic Inventory Model Finalized

✔ Dynamic Recovery Model Finalized

✔ Dynamic Expense Model Finalized

---

## Firebase

✔ Firebase Project Created

✔ Firebase Authentication Setup

✔ Firestore Connected

✔ Environment Variables Configured

---

## Authentication

✔ Login System

✔ Role Based Access Design

✔ User Structure Finalized

Roles:

Company Commander

Quarter Master

Clerk

Ustad

---

## UI

✔ Main Layout

✔ Sidebar

✔ Dashboard UI

✔ Commander Dashboard UI

✔ Quarter Master Dashboard UI

✔ Clerk Dashboard UI

✔ Ustad Dashboard UI

✔ Inventory Screens UI

✔ Finance Screens UI

✔ Settings UI

---

# CURRENTLY IN DEVELOPMENT

## Clerk Module

Status:

IN PROGRESS

Pending:

Batch Creation

Trainee CRUD

Document Verification

Weekly Program

Hospital Records

Leave Records

Detailed Ustad Records

---

## Quarter Master Module

Status:

IN PROGRESS

Completed:

Item Master Basic

Inventory List Basic

Pending:

Inventory Transactions

Issue Records

Recovery System

Expense System

Fund System

Bill Upload System

Reports

---

## Commander Module

Status:

PARTIAL

Completed:

Dashboard UI

Pending:

Reports

User Management

Monitoring Screens

Analytics

---

# NEXT PRIORITY

Priority 1

Complete Clerk Module

Reason:

All other modules depend on trainee data.

---

Priority 2

Complete Inventory Issue System

Reason:

Links Trainees and Inventory.

---

Priority 3

Complete Recovery System

Reason:

Links Trainees and Finance.

---

Priority 4

Complete Expense System

Reason:

Creates Actual Fund Management.

---

# DATABASE COLLECTIONS

Current Collections

users

trainees

item_master

---

Planned Collections

issue_records

inventory_transactions

recoveries

collections

expenses

fund_summary

weekly_programs

ustad_details

document_verification

activity_logs

---

# IMPORTANT BUSINESS RULES

Rule 1

Chest Number is the primary identity.

Every module must connect through Chest Number.

---

Rule 2

No hardcoded items.

All inventory items must be dynamic.

---

Rule 3

No hardcoded recoveries.

All recoveries must be dynamic.

---

Rule 4

No hardcoded expenses.

All expenses must be dynamic.

---

Rule 5

Commander is highest authority.

Commander can access all modules.

---

Rule 6

Quarter Master manages:

Inventory

Issue System

Recoveries

Expenses

Funds

---

Rule 7

Clerk manages:

Trainees

Documents

Weekly Program

Hospital Records

Leave Records

---

Rule 8

Ustad manages:

Training Information Only

---

# CURRENT BOTTLENECK

Main Development Blocker:

Quarter Master Finance Workflow

Pending Decisions:

Recovery Flow

Fund Flow

Expense Flow

Balance Calculation Flow

---

# IMMEDIATE NEXT TASK

Complete Clerk Module First

Then:

Inventory Issue System

Then:

Recovery System

Then:

Expense System

Then:

Commander Monitoring

---

# VERSION

Project Version:

v0.1 Alpha

Status:

Internal Development

Not Production Ready

---

END OF FILE

# COMPANY COMMANDER BLUEPRINT

## Role

Company Commander is the highest authority.

Commander can access all modules.

---

## Commander Dashboard

Total Trainees

Documents Completed

Documents Pending

Inventory Status

Fund Status

Recovery Status

Low Stock Alerts

Hospital Cases

Leave Cases

Training Status

---

## Permissions

View All Trainees

View All Documents

View Inventory

View Recoveries

View Funds

View Expenses

View Training

View Reports

Create Users

Disable Users

Manage Access

---

## Reports

Inventory Report

Recovery Report

Expense Report

Fund Report

Training Report

Document Report

Company Summary Report

# QUARTER MASTER MODULE BLUEPRINT

## BSF TRAINING COMMAND ERP

---

# ROLE PURPOSE

Quarter Master (QM) is responsible for:

1. Inventory Management
2. Item Master Management
3. Kit Issue System
4. Recovery Collection
5. Fund Management
6. Expense Management
7. Bill Management
8. Logistics Monitoring

Quarter Master can VIEW trainee records but cannot edit trainee personal information.

---

# QM DASHBOARD

## Summary Cards

Show:

* Total Trainees
* Total Inventory Items
* Low Stock Alerts
* Total Collection
* Total Expense
* Total Due
* Current Balance
* Pending Bills

---

## Current Balance Formula

Current Balance

=

Total Collection

*

Total Expense

---

# MODULE 1

# ITEM MASTER

Purpose:

Create inventory items dynamically.

No hardcoded items allowed.

Examples:

* PT Shoes
* DM Shoes
* Ground Sheet
* Mess Tin
* Tent
* Drill Dress
* Kemo Dress
* Mosquito Net
* Training Equipment
* Raw Material
* Any Future Item

---

## Item Fields

Item Name

Category

Description

Unit Price

Supplier Name

Supplier Contact

Size Required

Financial Type

Minimum Stock Alert

Active Status

Created Date

---

## Financial Types

* Company Asset
* Mess Fund
* Per Head Recovery
* Direct Expense
* Other

---

# MODULE 2

# INVENTORY MANAGEMENT

Purpose:

Maintain complete stock ledger.

Track:

Opening Stock

Received Quantity

Issued Quantity

Damaged Quantity

Current Stock

---

## Formula

Current Stock

=

Opening Stock

*

Received Quantity

*

Issued Quantity

*

Damaged Quantity

---

## Features

Add Stock

Receive Stock

Damage Entry

Stock History

Low Stock Alerts

Inventory Value

Supplier History

---

# MODULE 3

# KIT ISSUE SYSTEM

Purpose:

Issue items to trainees.

---

## Workflow

Search Chest Number

↓

Load Trainee Profile

↓

Select Items

↓

Select Size (if required)

↓

Issue Item

---

## System Actions

Reduce Inventory Stock

Create Issue Record

Update Trainee Profile

Create Issue History

---

## Fields

Chest Number

Trainee Name

Item Name

Quantity

Size

Issue Date

Issued By

Remarks

---

## Issue Status

Show:

Issued Items

Pending Items

Missing Items

Example:

PT Shoes = Issued

DM Shoes = Pending

Ground Sheet = Pending

Mess Tin = Issued

---

# MODULE 4

# RECOVERY MANAGEMENT

Purpose:

Track money recoverable from trainees.

---

## Recovery Types

Current:

Mess Cutting

Future:

Uniform Recovery

Equipment Recovery

Other Recovery

---

## Recovery Fields

Chest Number

Recovery Type

Expected Amount

Paid Amount

Due Amount

Status

---

## Status Values

Paid

Partial

Pending

---

# MESS CUTTING SYSTEM

Current Rule:

₹4650 Per Head Per Month

---

## Example

180 Trainees

×

₹4650

=

₹8,37,000

Expected Collection

System should calculate automatically.

---

## Trainee Payment Example

Expected:

₹4650

Paid:

₹3000

Due:

₹1650

Status:

Partial

Partial payment must be supported.

---

# MODULE 5

# COLLECTION MANAGEMENT

Purpose:

Track all incoming money.

---

## Collection Types

Mess Cutting

Other Recovery

Future Collections

---

## Fields

Date

Amount

Source

Received By

Remarks

---

# MODULE 6

# EXPENSE MANAGEMENT

Purpose:

Track all outgoing money.

---

## Expense Categories

Milk

Vegetables

Atta

Ration

Gas

Mess Boy Salary

Equipment Purchase

Training Material

Miscellaneous

---

## Fields

Date

Expense Type

Amount

Vendor

Remarks

Bill Status

---

# MODULE 7

# MESS BOY SALARY SYSTEM

Government Cook salary is NOT included.

Only Mess Boys.

---

## Default Rule

Daily Wage

₹350

---

## Example

7 Mess Boys

×

30 Days

×

₹350

=

₹73,500

Salary Expense

---

System should automatically calculate salary expense.

Salary should appear automatically in Expense Ledger.

---

# MODULE 8

# BILL MANAGEMENT

Bills are optional.

Expense entry must not stop if bill is unavailable.

---

## Supported Formats

PDF

JPG

JPEG

PNG

WEBP

---

## Bill Status

Pending

Uploaded

Verified

---

Users must be able to upload bills later.

---

# MODULE 9

# FUND MANAGEMENT

Purpose:

Monitor company fund status.

---

## Show

Total Collection

Total Expense

Total Due

Current Balance

---

## Formula

Current Balance

=

Collection

*

Expense

---

# MODULE 10

# LOW STOCK ALERTS

Each inventory item contains:

Minimum Stock Alert

Example:

PT Shoes

Alert Level:

10

If Current Stock ≤ 10

Show:

LOW STOCK

---

# MODULE 11

# REPORTS

Inventory Report

Stock Report

Issue Report

Recovery Report

Expense Report

Collection Report

Fund Summary Report

Pending Bills Report

Low Stock Report

---

## Export Formats

PDF

Excel

---

# MODULE 12

# PERMISSIONS

Quarter Master CAN:

✓ View Trainees

✓ Manage Item Master

✓ Manage Inventory

✓ Manage Issue System

✓ Manage Recoveries

✓ Manage Collections

✓ Manage Expenses

✓ Manage Bills

✓ Generate Reports

---

Quarter Master CANNOT:

✗ Edit Trainee Personal Information

✗ Edit Documents

✗ Create Users

✗ Access System Settings

---

# DATABASE COLLECTIONS

item_master

inventory_transactions

issue_records

recoveries

collections

expenses

fund_summary

---

# FINAL QM WORKFLOW

Clerk Creates Trainee

↓

Quarter Master Views Trainee

↓

Quarter Master Issues Kit

↓

Stock Reduced

↓

Issue Record Created

↓

Recovery Generated

↓

Mess Cutting Collected

↓

Collection Added

↓

Expenses Recorded

↓

Balance Updated

↓

Company Commander Monitors Everything

---

END OF QM BLUEPRINT

# CLERK MODULE BLUEPRINT

## Responsibilities

The Clerk is responsible for trainee administration.

---

## Batch Management

Create Batch

Batch Year

Training Session

Company

---

## Trainee Management

Add Trainee

Edit Trainee

View Trainee

Search Trainee

---

## Required Fields

Chest Number

Name

Father Name

DOB

Category

Mobile

Address

Joining Date

Platoon

Remarks

---

## Document Management

Aadhaar

PAN

Bank Passbook

Educational Certificates

Medical Documents

Other Documents

Status:

Complete

Pending

Rejected

Verified

---

## Weekly Program

Create Weekly Program

Training Schedule

Detailed Ustad Information

Remarks

---

## Medical Status

Hospital

Sick Report

Medical Board

Leave

Light Duty

---

## Clerk Dashboard

Total Trainees

Pending Documents

Hospital Cases

Leave Cases

Weekly Program Status

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
