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